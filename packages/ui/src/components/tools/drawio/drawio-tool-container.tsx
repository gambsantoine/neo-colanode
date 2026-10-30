import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Container } from '@colanode/ui/components/layouts/containers/container';
import { DiagramOpenDialog } from '@colanode/ui/components/tools/diagrams/diagram-open-dialog';
import {
  buildBaseName,
  DiagramSaveDialog,
  DiagramSaveTarget,
} from '@colanode/ui/components/tools/diagrams/diagram-save-dialog';
import { DiagramToolBreadcrumb } from '@colanode/ui/components/tools/diagrams/diagram-tool-breadcrumb';
import { DrawioRibbon } from '@colanode/ui/components/tools/drawio/drawio-ribbon';
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
import { Button } from '@colanode/ui/components/ui/button';
import { useTheme } from '@colanode/ui/contexts/theme';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import {
  buildDiagramFile,
  DiagramFileOption,
  getDiagramMetadataKeys,
  readDiagramFile,
  replaceDiagramFile,
  useDiagramFiles,
} from '@colanode/ui/lib/diagram-files';
import { drawioLanguage } from '@colanode/ui/lib/diagram-languages';
import { downloadBlob } from '@colanode/ui/lib/download';
import {
  buildDrawioUrl,
  DRAWIO_ORIGIN,
  DrawioAction,
  drawioDataToBlob,
  drawioDataToText,
  parseDrawioMessage,
} from '@colanode/ui/lib/drawio';
import { createFileNode } from '@colanode/ui/lib/files';

const DEFAULT_FILE_NAME = 'diagram';
const DRAFT_SAVE_DELAY_MS = 500;
// draw.io is loaded from another origin and may be unreachable (offline...).
const LOAD_TIMEOUT_MS = 30_000;
const IMPORT_EXTENSIONS = ['.drawio', '.dio', '.xml', '.svg'];

interface DrawioOpenedFile {
  id: string;
  name: string;
  parentId: string;
  canEdit: boolean;
}

// What the next export answered by draw.io is for.
type PendingExport =
  | { type: 'save'; target: DiagramSaveTarget & { replaceId?: string } }
  | { type: 'download'; format: 'svg' | 'png' };

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// draw.io editor in an iframe. The diagrams are saved as `.drawio.svg` files of
// the workspace, and the current one as a draft in the local metadata.
export const DrawioToolContainer = () => {
  const workspace = useWorkspace();
  const theme = useTheme();
  const navigate = useNavigate({ from: '/workspace/$userId' });
  const { files, isLoading: isLoadingFiles } = useDiagramFiles(drawioLanguage);
  const metadataKeys = getDiagramMetadataKeys(drawioLanguage);

  const [storedDraft, setStoredDraft] = useMetadata<string>(
    workspace.userId,
    metadataKeys.draft
  );
  const [storedFolderId, setStoredFolderId] = useMetadata<string>(
    workspace.userId,
    metadataKeys.folderId
  );
  const [openedFile, setOpenedFile] = useMetadata<DrawioOpenedFile>(
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

  const [draft, setDraft] = useState<string | null>(null);
  const code = draft ?? storedDraft ?? drawioLanguage.defaultCode;

  const [untitledName, setUntitledName] = useState(DEFAULT_FILE_NAME);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pendingExportRef = useRef<PendingExport | null>(null);
  // Set while a diagram is loaded: draw.io answers with its normalized source,
  // which becomes the reference used to detect changes.
  const awaitingBaselineRef = useRef(false);

  const openedFileInfo = openedFile
    ? files.find((file) => file.id === openedFile.id)
    : undefined;
  const isOpenedFileMissing =
    openedFile !== undefined && !isLoadingFiles && !openedFileInfo;
  const baseline = openedFile ? (savedCode ?? '') : drawioLanguage.defaultCode;
  const isDirty = code !== baseline || isOpenedFileMissing;
  const canEditOpenedFile = openedFileInfo?.canEdit ?? openedFile?.canEdit;
  const isReadOnly = openedFile !== undefined && !canEditOpenedFile;

  const fileName = openedFile
    ? openedFile.name
    : untitledName + drawioLanguage.fileExtension;
  const baseName = buildBaseName(
    openedFile?.name ?? untitledName,
    DEFAULT_FILE_NAME
  );
  const location = openedFileInfo
    ? `${openedFileInfo.spaceName} / ${openedFileInfo.folderName}`
    : isOpenedFileMissing
      ? 'deleted from the workspace'
      : null;

  const dark = theme.mode === 'dark';
  const src = useMemo(() => buildDrawioUrl(dark), [dark]);

  const send = (action: DrawioAction) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify(action),
      DRAWIO_ORIGIN
    );
  };

  const loadDiagram = (content: string, title: string) => {
    send({ action: 'load', xml: content, autosave: 1, title });
  };

  // Persist the draft (debounced, flushed on unmount), like the other editors.
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

  useEffect(() => {
    if (status !== 'loading') {
      return;
    }

    const timeout = setTimeout(() => setStatus('error'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [status, attempt, src]);

  const replaceCode = (content: string) => {
    setDraft(content);
    setStoredDraft(content);
    unsavedDraftRef.current = null;
  };

  const runGuarded = (action: () => void) => {
    if (isDirty) {
      setConfirmAction(() => action);
    } else {
      action();
    }
  };

  const newDiagram = () => {
    runGuarded(() => {
      replaceCode(drawioLanguage.defaultCode);
      setOpenedFile(undefined);
      setSavedCode(undefined);
      setUntitledName(DEFAULT_FILE_NAME);
      awaitingBaselineRef.current = false;
      loadDiagram(
        drawioLanguage.defaultCode,
        DEFAULT_FILE_NAME + drawioLanguage.fileExtension
      );
    });
  };

  const openFile = async (file: DiagramFileOption) => {
    setIsOpenDialogOpen(false);
    setIsLoadingFile(true);
    try {
      const content = await readDiagramFile(workspace.userId, file.id);
      setOpenedFile({
        id: file.id,
        name: file.name,
        parentId: file.parentId,
        canEdit: file.canEdit,
      });
      awaitingBaselineRef.current = true;
      loadDiagram(content, file.name);
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
      const name = buildBaseName(file.name, DEFAULT_FILE_NAME);
      setOpenedFile(undefined);
      setSavedCode(undefined);
      setUntitledName(name);
      awaitingBaselineRef.current = false;
      replaceCode(content);
      loadDiagram(content, name + drawioLanguage.fileExtension);
      toast.success(
        `Imported ${file.name}, save it to keep it in the workspace`
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to import the file'));
    }
  };

  const requestExport = (pending: PendingExport) => {
    pendingExportRef.current = pending;
    send({
      action: 'export',
      format:
        pending.type === 'download' && pending.format === 'png'
          ? 'xmlpng'
          : 'xmlsvg',
    });
  };

  const writeFile = async (
    target: DiagramSaveTarget & { replaceId?: string },
    svg: string
  ) => {
    const replaceId = target.replace?.id ?? target.replaceId;
    const file = buildDiagramFile(drawioLanguage, target.baseName, svg);

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
      setSavedCode(codeRef.current);
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

  const saveTo = (target: DiagramSaveTarget & { replaceId?: string }) => {
    setIsSaving(true);
    requestExport({ type: 'save', target });
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

      saveTo({
        baseName,
        folderId: openedFile.parentId,
        replaceId: openedFile.id,
      });
      return;
    }

    setIsSaveDialogOpen(true);
  };

  // draw.io messages are handled through a ref: the listener outlives renders.
  const handlersRef = useRef({
    onMessage: (_: ReturnType<typeof parseDrawioMessage>) => {},
  });
  const codeRef = useRef(code);
  codeRef.current = code;

  handlersRef.current.onMessage = (message) => {
    switch (message?.event) {
      case 'init':
        setStatus('ready');
        loadDiagram(codeRef.current, fileName);
        break;
      case 'load':
        if (awaitingBaselineRef.current) {
          awaitingBaselineRef.current = false;
          const content = message.xml ?? '';
          replaceCode(content);
          setSavedCode(content);
        }
        break;
      case 'autosave':
        setDraft(message.xml);
        break;
      case 'save':
        setDraft(message.xml);
        save();
        break;
      case 'export': {
        const pending = pendingExportRef.current;
        pendingExportRef.current = null;
        if (pending?.type === 'save') {
          void writeFile(pending.target, drawioDataToText(message.data));
        } else if (pending?.type === 'download') {
          const type = pending.format === 'png' ? 'image/png' : 'image/svg+xml';
          downloadBlob(
            drawioDataToBlob(message.data, type),
            `${baseName}.${pending.format}`
          );
        }
        break;
      }
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Other frames can post to this window: only draw.io is listened to.
      if (
        event.origin !== DRAWIO_ORIGIN ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        return;
      }

      const message = parseDrawioMessage(event.data);
      if (message) {
        handlersRef.current.onMessage(message);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Opens the file requested from another view (e.g. a file preview).
  useEffect(() => {
    if (!pendingFileId || isLoadingFiles || status !== 'ready') {
      return;
    }

    setPendingFileId(undefined);
    const file = files.find((item) => item.id === pendingFileId);
    if (!file) {
      toast.error('The draw.io file could not be found');
      return;
    }

    if (file.id === openedFile?.id && !isDirty) {
      return;
    }

    runGuarded(() => void openFile(file));
  }, [pendingFileId, isLoadingFiles, status]);

  return (
    <Container
      type="full"
      breadcrumb={<DiagramToolBreadcrumb language={drawioLanguage} />}
      flush
    >
      <div className="flex h-full flex-col">
        <DrawioRibbon
          fileName={fileName}
          location={location}
          isDirty={isDirty}
          isReadOnly={isReadOnly}
          isBusy={isSaving || isLoadingFile}
          canExport={status === 'ready'}
          onNew={newDiagram}
          onOpen={() => runGuarded(() => setIsOpenDialogOpen(true))}
          onImport={() => runGuarded(() => importInputRef.current?.click())}
          onSave={save}
          onSaveAs={() => setIsSaveDialogOpen(true)}
          onExportSvg={() => requestExport({ type: 'download', format: 'svg' })}
          onExportPng={() => requestExport({ type: 'download', format: 'png' })}
        />
        {status === 'error' ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <p>
              The draw.io editor could not be loaded from {DRAWIO_ORIGIN}. Check
              your connection. Your draft is kept.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus('loading');
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <iframe
            key={`${src}-${attempt}`}
            ref={iframeRef}
            src={src}
            title="draw.io editor"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write"
            className="min-h-0 w-full flex-1 border-0"
          />
        )}
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_EXTENSIONS.join(',')}
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
        language={drawioLanguage}
        open={isOpenDialogOpen}
        onOpenChange={setIsOpenDialogOpen}
        onSelect={(file) => void openFile(file)}
        currentFileId={openedFile?.id}
      />
      <DiagramSaveDialog
        language={drawioLanguage}
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        defaultName={baseName}
        defaultFolderId={openedFile?.parentId ?? storedFolderId}
        isSaving={isSaving}
        onSave={saveTo}
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
