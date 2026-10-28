import { useNavigate } from '@tanstack/react-router';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DiagramPreview } from '@colanode/ui/components/diagrams/diagram-preview';
import { Container } from '@colanode/ui/components/layouts/containers/container';
import { DiagramOpenDialog } from '@colanode/ui/components/tools/diagrams/diagram-open-dialog';
import {
  DiagramLayout,
  DiagramRibbon,
} from '@colanode/ui/components/tools/diagrams/diagram-ribbon';
import {
  buildBaseName,
  DiagramSaveDialog,
  DiagramSaveTarget,
} from '@colanode/ui/components/tools/diagrams/diagram-save-dialog';
import { DiagramToolBreadcrumb } from '@colanode/ui/components/tools/diagrams/diagram-tool-breadcrumb';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@colanode/ui/components/ui/alert-dialog';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import {
  applyTextEdit,
  duplicateLines,
  getCaretPosition,
  indentLines,
  insertSnippet,
  TextEdit,
  toggleComment,
} from '@colanode/ui/lib/diagram-editing';
import {
  buildDiagramFile,
  DIAGRAM_MIME_TYPE,
  DiagramFileOption,
  getDiagramMetadataKeys,
  readDiagramFile,
  replaceDiagramFile,
  useDiagramFiles,
} from '@colanode/ui/lib/diagram-files';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';
import { downloadBlob } from '@colanode/ui/lib/download';
import { createFileNode } from '@colanode/ui/lib/files';
import { svgToPngBlob } from '@colanode/ui/lib/svg';
import { cn } from '@colanode/ui/lib/utils';

const DEFAULT_FILE_NAME = 'diagram';
const DRAFT_SAVE_DELAY_MS = 500;
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

// File of the workspace currently edited, persisted with the draft so the
// editor reopens it after a restart.
interface DiagramOpenedFile {
  id: string;
  name: string;
  parentId: string;
  canEdit: boolean;
}

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

interface DiagramToolContainerProps {
  language: DiagramLanguage;
}

// Text-based diagram editor (PlantUML, Mermaid...) with a live preview,
// saving its diagrams as files of the workspace.
export const DiagramToolContainer = ({
  language,
}: DiagramToolContainerProps) => {
  const workspace = useWorkspace();
  const navigate = useNavigate({ from: '/workspace/$userId' });
  const { files, isLoading: isLoadingFiles } = useDiagramFiles(language);
  const metadataKeys = getDiagramMetadataKeys(language);

  const [storedDraft, setStoredDraft] = useMetadata<string>(
    workspace.userId,
    metadataKeys.draft
  );
  const [storedFolderId, setStoredFolderId] = useMetadata<string>(
    workspace.userId,
    metadataKeys.folderId
  );
  const [openedFile, setOpenedFile] = useMetadata<DiagramOpenedFile>(
    workspace.userId,
    metadataKeys.file
  );
  const [savedCode, setSavedCode] = useMetadata<string>(
    workspace.userId,
    metadataKeys.savedCode
  );
  const [pendingFileId, setPendingFileId] = useMetadata<string>(
    workspace.userId,
    metadataKeys.pendingFileId
  );

  // `draft` stays null until the user edits the code, so the stored draft
  // (loaded asynchronously) is shown until then.
  const [draft, setDraft] = useState<string | null>(null);
  const code = draft ?? storedDraft ?? language.defaultCode;

  // A file deleted elsewhere is treated as a new, unsaved diagram.
  const openedFileInfo = openedFile
    ? files.find((file) => file.id === openedFile.id)
    : undefined;
  const isOpenedFileMissing =
    openedFile !== undefined && !isLoadingFiles && !openedFileInfo;
  const baseline = openedFile ? (savedCode ?? '') : language.defaultCode;
  const isDirty = code !== baseline || isOpenedFileMissing;
  const canEditOpenedFile = openedFileInfo?.canEdit ?? openedFile?.canEdit;
  const isReadOnly = openedFile !== undefined && !canEditOpenedFile;

  const [untitledName, setUntitledName] = useState(DEFAULT_FILE_NAME);
  const [layout, setLayout] = useState<DiagramLayout>('split');
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Persist the draft in the local metadata (debounced, flushed on unmount)
  // so it survives navigation and restarts.
  const setStoredDraftRef = useRef(setStoredDraft);
  setStoredDraftRef.current = setStoredDraft;
  const unsavedDraftRef = useRef<string | null>(null);

  useEffect(() => {
    if (draft === null) {
      return;
    }

    unsavedDraftRef.current = draft;
    const timeout = setTimeout(() => {
      setStoredDraftRef.current(draft);
      unsavedDraftRef.current = null;
    }, DRAFT_SAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [draft]);

  useEffect(() => {
    return () => {
      if (unsavedDraftRef.current !== null) {
        setStoredDraftRef.current(unsavedDraftRef.current);
      }
    };
  }, []);

  const fileName = openedFile
    ? openedFile.name
    : untitledName + language.fileExtension;
  const baseName = buildBaseName(
    openedFile?.name ?? untitledName,
    DEFAULT_FILE_NAME
  );
  const location = openedFileInfo
    ? `${openedFileInfo.spaceName} / ${openedFileInfo.folderName}`
    : isOpenedFileMissing
      ? 'deleted from the workspace'
      : null;

  // Replaces the whole content (new diagram, opened file...).
  const replaceCode = (content: string) => {
    setDraft(content);
    setStoredDraft(content);
    unsavedDraftRef.current = null;
    setCaret({ line: 1, column: 1 });
  };

  // Runs `action` right away, or after confirmation when the current diagram
  // has unsaved changes.
  const runGuarded = (action: () => void) => {
    if (isDirty) {
      setConfirmAction(() => action);
    } else {
      action();
    }
  };

  const newDiagram = (template?: string) => {
    runGuarded(() => {
      replaceCode(template ?? language.defaultCode);
      setOpenedFile(undefined);
      setSavedCode(undefined);
      setUntitledName(DEFAULT_FILE_NAME);
    });
  };

  const openFile = async (file: DiagramFileOption) => {
    setIsOpenDialogOpen(false);
    setIsLoadingFile(true);
    try {
      const content = await readDiagramFile(workspace.userId, file.id);
      replaceCode(content);
      setSavedCode(content);
      setOpenedFile({
        id: file.id,
        name: file.name,
        parentId: file.parentId,
        canEdit: file.canEdit,
      });
      toast.success(`Opened ${file.name}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to open the file'));
    } finally {
      setIsLoadingFile(false);
    }
  };

  const importFromComputer = async (file: File) => {
    try {
      const content = await file.text();
      replaceCode(content);
      setOpenedFile(undefined);
      setSavedCode(undefined);
      setUntitledName(buildBaseName(file.name, DEFAULT_FILE_NAME));
      toast.success(
        `Imported ${file.name}, save it to keep it in the workspace`
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to import the file'));
    }
  };

  const saveTo = async (target: DiagramSaveTarget & { replaceId?: string }) => {
    const replaceId = target.replace?.id ?? target.replaceId;
    const file = buildDiagramFile(language, target.baseName, code);

    setIsSaving(true);
    try {
      let fileId: string;
      if (replaceId) {
        const result = await replaceDiagramFile(
          workspace.userId,
          replaceId,
          target.folderId,
          file
        );
        fileId = result.fileId;
        if (result.deleteError) {
          toast.warning(
            `Saved, but the previous version could not be removed: ${result.deleteError}`
          );
        }
      } else {
        fileId = await createFileNode(workspace.userId, target.folderId, file);
      }

      setOpenedFile({
        id: fileId,
        name: file.name,
        parentId: target.folderId,
        canEdit: true,
      });
      setSavedCode(code);
      setStoredFolderId(target.folderId);
      setIsSaveDialogOpen(false);

      const folderId = target.folderId;
      toast.success(`Saved ${file.name}`, {
        action: {
          label: 'Open folder',
          onClick: () => {
            navigate({ to: '$nodeId', params: { nodeId: folderId } });
          },
        },
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save the diagram'));
    } finally {
      setIsSaving(false);
    }
  };

  const save = () => {
    if (isSaving) {
      return;
    }

    if (openedFile && openedFileInfo?.canEdit) {
      if (!isDirty) {
        toast.info('No changes to save');
        return;
      }

      void saveTo({
        baseName,
        folderId: openedFile.parentId,
        replaceId: openedFile.id,
      });
      return;
    }

    setIsSaveDialogOpen(true);
  };

  const exportDiagram = async (format: 'svg' | 'png') => {
    setIsExporting(true);
    try {
      // Always export the light rendering, regardless of the app theme.
      const svg = await language.render(code);
      const blob =
        format === 'svg'
          ? new Blob([svg], { type: 'image/svg+xml' })
          : await svgToPngBlob(svg);
      downloadBlob(blob, `${baseName}.${format}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to export the diagram'));
    } finally {
      setIsExporting(false);
    }
  };

  const edit = (
    build: (value: string, start: number, end: number) => TextEdit
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const result = build(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd
    );
    applyTextEdit(textarea, result, setDraft);
  };

  const runHistoryCommand = (command: 'undo' | 'redo') => {
    textareaRef.current?.focus();
    document.execCommand(command);
  };

  const changeZoom = (direction: 1 | -1) => {
    // From "fit", start from 100%.
    const current = zoom ?? 1;
    const next =
      direction === 1
        ? (ZOOM_STEPS.find((step) => step > current) ?? ZOOM_STEPS.at(-1))
        : ([...ZOOM_STEPS].reverse().find((step) => step < current) ??
          ZOOM_STEPS[0]);
    setZoom(next);
  };

  // Opens the file requested from another view (e.g. a .puml file preview).
  useEffect(() => {
    if (!pendingFileId || isLoadingFiles) {
      return;
    }

    setPendingFileId(undefined);
    const file = files.find((item) => item.id === pendingFileId);
    if (!file) {
      toast.error(`The ${language.name} file could not be found`);
      return;
    }

    if (file.id === openedFile?.id && !isDirty) {
      return;
    }

    runGuarded(() => void openFile(file));
  }, [pendingFileId, isLoadingFiles]);

  // Ribbon shortcuts, active while the editor is displayed.
  const shortcutsRef = useRef({ save, saveAs: () => {}, open: () => {} });
  shortcutsRef.current = {
    save,
    saveAs: () => setIsSaveDialogOpen(true),
    open: () => runGuarded(() => setIsOpenDialogOpen(true)),
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          shortcutsRef.current.saveAs();
        } else {
          shortcutsRef.current.save();
        }
      } else if (key === 'o' && !event.shiftKey) {
        event.preventDefault();
        shortcutsRef.current.open();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Tab' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      edit((value, start, end) =>
        indentLines(value, start, end, event.shiftKey ? 'out' : 'in')
      );
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      edit(commentLines);
    }
  };

  const commentLines = (value: string, start: number, end: number) =>
    toggleComment(value, start, end, language.commentMarker);

  const updateCaret = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setCaret(getCaretPosition(textarea.value, textarea.selectionStart));
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <Container
      type="full"
      breadcrumb={<DiagramToolBreadcrumb language={language} />}
      flush
    >
      <div className="flex h-full flex-col">
        <DiagramRibbon
          language={language}
          fileName={fileName}
          location={location}
          isDirty={isDirty}
          isReadOnly={isReadOnly}
          isSaving={isSaving}
          isLoadingFile={isLoadingFile}
          isExporting={isExporting}
          canOpenFolder={openedFileInfo !== undefined}
          layout={layout}
          zoom={zoom}
          onNew={newDiagram}
          onOpen={() => runGuarded(() => setIsOpenDialogOpen(true))}
          onImport={() => runGuarded(() => importInputRef.current?.click())}
          onSave={save}
          onSaveAs={() => setIsSaveDialogOpen(true)}
          onOpenFolder={() => {
            if (openedFileInfo) {
              navigate({
                to: '$nodeId',
                params: { nodeId: openedFileInfo.parentId },
              });
            }
          }}
          onExportSvg={() => void exportDiagram('svg')}
          onExportPng={() => void exportDiagram('png')}
          onDownloadSource={() =>
            downloadBlob(
              new Blob([code], { type: DIAGRAM_MIME_TYPE }),
              baseName + language.fileExtension
            )
          }
          onUndo={() => runHistoryCommand('undo')}
          onRedo={() => runHistoryCommand('redo')}
          onIndent={() =>
            edit((value, start, end) => indentLines(value, start, end, 'in'))
          }
          onOutdent={() =>
            edit((value, start, end) => indentLines(value, start, end, 'out'))
          }
          onToggleComment={() => edit(commentLines)}
          onDuplicate={() => edit(duplicateLines)}
          onInsertSnippet={(snippet) => {
            if (layout === 'preview') {
              setLayout('split');
            }
            edit((value, start, end) =>
              insertSnippet(value, start, end, snippet)
            );
          }}
          onLayoutChange={setLayout}
          onZoomIn={() => changeZoom(1)}
          onZoomOut={() => changeZoom(-1)}
          onZoomChange={setZoom}
        />
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1',
            // Small space between the editor and the preview.
            layout === 'split' && 'gap-2 lg:grid-cols-2'
          )}
        >
          <div
            className={cn(
              'flex min-h-80 flex-col overflow-hidden lg:h-full',
              layout === 'preview' && 'hidden'
            )}
          >
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(event) => {
                setDraft(event.target.value);
                updateCaret();
              }}
              onKeyDown={handleKeyDown}
              onSelect={updateCaret}
              onClick={updateCaret}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label={`${language.name} code`}
              className="min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-relaxed outline-none dark:bg-input/30"
            />
            <div className="flex justify-between border-t border-input bg-muted/30 px-3 py-1 text-xs text-muted-foreground tabular-nums">
              <span>
                Ln {caret.line}, Col {caret.column}
              </span>
              <span>{lineCount} lines</span>
            </div>
          </div>
          <div
            className={cn(
              'flex min-h-80 overflow-auto bg-background p-4 lg:h-full',
              layout === 'split' &&
                'border-t border-input lg:border-t-0 lg:border-l',
              layout === 'code' && 'hidden'
            )}
          >
            {/* m-auto centers the diagram while keeping overflow scrollable. */}
            <div className="m-auto">
              <DiagramPreview
                language={language}
                code={code}
                debounceMs={300}
                zoom={zoom}
              />
            </div>
          </div>
        </div>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept={[...language.fileExtensions, '.txt', 'text/plain'].join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            void importFromComputer(file);
          }
        }}
      />
      <DiagramOpenDialog
        language={language}
        open={isOpenDialogOpen}
        onOpenChange={setIsOpenDialogOpen}
        onSelect={(file) => void openFile(file)}
        currentFileId={openedFile?.id}
      />
      <DiagramSaveDialog
        language={language}
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        defaultName={baseName}
        defaultFolderId={openedFile?.parentId ?? storedFolderId}
        isSaving={isSaving}
        onSave={(target) => void saveTo(target)}
      />
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The changes made to {fileName} have not been saved in the
              workspace and will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                action?.();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  );
};
