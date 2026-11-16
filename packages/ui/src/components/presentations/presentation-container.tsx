import {
  Columns2,
  Download,
  Eye,
  MonitorPlay,
  PenLine,
  Play,
  StepForward,
  Upload,
} from 'lucide-react';
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInView } from 'react-intersection-observer';
import { toast } from 'sonner';

import { LocalPresentationNode } from '@colanode/client/types';
import { NodeRole, PresentationFormat, hasNodeRole } from '@colanode/core';
import {
  CodeEditor,
  CodeEditorHandle,
} from '@colanode/ui/components/presentations/code-editor';
import { PresentationPlayer } from '@colanode/ui/components/presentations/presentation-player';
import { PresenterWindow } from '@colanode/ui/components/presentations/presenter-window';
import { RevealPlayer } from '@colanode/ui/components/presentations/reveal-player';
import { RevealView } from '@colanode/ui/components/presentations/reveal-view';
import {
  SlideView,
  resolveDeckDark,
} from '@colanode/ui/components/presentations/slide-view';
import { Button } from '@colanode/ui/components/ui/button';
import { useTheme } from '@colanode/ui/contexts/theme';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { downloadBlob } from '@colanode/ui/lib/download';
import { PresentationController } from '@colanode/ui/lib/presentation-controller';
import { openPresenterWindow } from '@colanode/ui/lib/presenter-window';
import {
  DEFAULT_REVEAL_CONTENT,
  parseRevealDeck,
} from '@colanode/ui/lib/reveal';
import {
  DEFAULT_PRESENTATION_CONTENT,
  SLIDES_FILE_EXTENSION,
  Slide,
  findSlideAtLine,
  parseDeck,
} from '@colanode/ui/lib/slides';
import { cn } from '@colanode/ui/lib/utils';

type PresentationLayout = 'editor' | 'split' | 'preview';

const SAVE_DELAY_MS = 400;
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;
const IMPORT_ACCEPT =
  '.md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html';

const isTextFile = (file: File) =>
  /\.(md|markdown|txt|html?)$/i.test(file.name) ||
  ['text/markdown', 'text/plain', 'text/html'].includes(file.type);

const toFileName = (name: string, extension: string) =>
  (name.trim() || 'presentation').replace(/[\\/:*?"<>|]+/g, '-') + extension;

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
  const [presenterWindow, setPresenterWindow] = useState<Window | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);
  const controllerRef = useRef<PresentationController | null>(null);

  const editorRef = useRef<CodeEditorHandle | null>(null);
  const cursorLineRef = useRef(0);
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

    // The editor applies the change in place, keeping the cursor.
    lastSavedRef.current = remote;
    setDraft(remote);
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
  const isHtml = revealDeck?.source === 'html';
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

  // Audience window (this one, to move to the projector) + presenter window.
  const startPresenter = () => {
    const popup = openPresenterWindow();
    if (!popup) {
      toast.error('The presenter window was blocked', {
        description: 'Allow pop-ups for this site, then try again.',
      });
      return;
    }

    setPlayerIndex(current);
    setPresenterWindow(popup);
    setPlayerStart(current);
    toast.info('Presenter view opened', {
      description:
        'Move this window to the projector, then press F for full screen.',
    });
  };

  const closePlayer = (index: number) => {
    setPlayerStart(null);
    setPresenterWindow(null);
    setCurrentIndex(index);
  };

  // The preview follows the slide under the caret.
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const handleCursorLine = (line: number) => {
    cursorLineRef.current = line;
    setCurrentIndex(findSlideAtLine(deckRef.current, line));
  };

  // Typing may add or remove slides before the caret.
  useEffect(() => {
    if (editorRef.current?.hasFocus()) {
      setCurrentIndex(findSlideAtLine(deck, cursorLineRef.current));
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

    const slide = deck.slides[index];
    if (!slide || layout === 'preview') {
      return;
    }

    // Puts the cursor at the start of the slide in the source.
    editorRef.current?.setCursorLine(slide.startLine);
  };

  const replaceContent = (content: string, source: string) => {
    const normalized = content.replace(/\r\n?/g, '\n');
    const editor = layout !== 'preview' ? editorRef.current : null;

    if (editor) {
      // One edit in the editor history: Ctrl+Z restores the previous deck.
      editor.replaceAll(normalized);
    } else {
      updateDraft(normalized);
    }

    setCurrentIndex(0);
    toast.success(`Imported ${source}`, {
      description: editor ? 'Press Ctrl+Z in the editor to undo.' : undefined,
    });
  };

  const importFile = async (file: File) => {
    if (!canEdit) {
      return;
    }

    if (!isTextFile(file)) {
      toast.error('Only Markdown (.md) or HTML (.html) files can be imported.');
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
      new Blob([draft], {
        type: isHtml
          ? 'text/html;charset=utf-8'
          : 'text/markdown;charset=utf-8',
      }),
      toFileName(presentation.name, isHtml ? '.html' : SLIDES_FILE_EXTENSION)
    );
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
        <Button
          size="sm"
          variant="outline"
          onClick={startPresenter}
          title="Open the presenter view (notes, next slide, timer) in a second window"
        >
          <MonitorPlay className="size-4" />
          Presenter view
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => importInputRef.current?.click()}
            title="Replace the deck with a Markdown or HTML file (or drop a file on the editor)"
          >
            <Upload className="size-4" />
            Import
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={exportFile}>
          <Download className="size-4" />
          Export {isHtml ? '.html' : '.md'}
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
            // Capture: the editor would handle the drop itself.
            onDragOverCapture={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDropCapture={handleDrop}
          >
            <CodeEditor
              value={draft}
              onChange={updateDraft}
              readOnly={!canEdit}
              dark={theme.mode === 'dark'}
              placeholder={
                format === 'reveal'
                  ? 'Paste your Reveal.js deck: HTML (<section>...</section> or a whole page) or Markdown (slides separated by ---, vertical: --)'
                  : 'Paste or write your Slidev Markdown here. Separate slides with ---'
              }
              language={isHtml ? 'html' : 'markdown'}
              onCursorLineChange={handleCursorLine}
              onPresent={(fromCurrent) =>
                setPlayerStart(fromCurrent ? current : 0)
              }
              handleRef={editorRef}
              className="flex-1"
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
                    <SlideThumbnail slide={item} dark={dark} />
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
          onClose={closePlayer}
          onIndexChange={setPlayerIndex}
          controllerRef={presenterWindow ? controllerRef : undefined}
        />
      )}
      {playerStart !== null && slidevDeck && (
        <PresentationPlayer
          deck={slidevDeck}
          dark={dark}
          startIndex={playerStart}
          onClose={closePlayer}
          onIndexChange={setPlayerIndex}
          controllerRef={presenterWindow ? controllerRef : undefined}
        />
      )}
      {presenterWindow && playerStart !== null && (
        <PresenterWindow
          popup={presenterWindow}
          title={presentation.name}
          presenterDeck={
            revealDeck
              ? { format: 'reveal', deck: revealDeck }
              : { format: 'slidev', deck: slidevDeck!, dark }
          }
          index={playerIndex}
          getController={() => controllerRef.current}
          onClose={(ended) => {
            setPresenterWindow(null);
            if (ended) {
              setPlayerStart(null);
              setCurrentIndex(playerIndex);
            }
          }}
        />
      )}
    </div>
  );
};

// Thumbnails are frames: only the visible ones are rendered.
const SlideThumbnail = ({ slide, dark }: { slide: Slide; dark: boolean }) => {
  const { ref, inView } = useInView({ rootMargin: '200px' });
  return (
    <div ref={ref} className="pointer-events-none h-full w-full">
      {inView && <SlideView slide={slide} dark={dark} />}
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
