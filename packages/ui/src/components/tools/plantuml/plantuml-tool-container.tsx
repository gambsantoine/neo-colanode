import { useNavigate } from '@tanstack/react-router';
import { FileDown, Save } from 'lucide-react';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { FolderSelect } from '@colanode/ui/components/folders/folder-select';
import { Container } from '@colanode/ui/components/layouts/containers/container';
import { PlantUmlPreview } from '@colanode/ui/components/plantuml/plantuml-preview';
import { PlantUmlToolBreadcrumb } from '@colanode/ui/components/tools/plantuml/plantuml-tool-breadcrumb';
import { Button } from '@colanode/ui/components/ui/button';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { createFileNode } from '@colanode/ui/lib/files';
import {
  DEFAULT_PLANTUML_CODE,
  PLANTUML_FILE_EXTENSION,
  PLANTUML_MIME_TYPE,
  renderPlantUml,
} from '@colanode/ui/lib/plantuml';

const DEFAULT_FILE_NAME = 'diagram';
const DRAFT_SAVE_DELAY_MS = 500;
const INDENT = '  ';

// Strips the extension and characters that are invalid in file names.
const buildBaseName = (name: string): string => {
  const base = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\.puml$/i, '')
    .trim();
  return base.length > 0 ? base : DEFAULT_FILE_NAME;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const PlantUmlToolContainer = () => {
  const workspace = useWorkspace();
  const navigate = useNavigate({ from: '/workspace/$userId' });

  const [storedDraft, setStoredDraft] = useMetadata<string>(
    workspace.userId,
    'tools.plantuml.draft'
  );
  const [storedFolderId, setStoredFolderId] = useMetadata<string>(
    workspace.userId,
    'tools.plantuml.folderId'
  );

  // `draft` stays null until the user edits the code, so the stored draft
  // (loaded asynchronously) is shown until then.
  const [draft, setDraft] = useState<string | null>(null);
  const code = draft ?? storedDraft ?? DEFAULT_PLANTUML_CODE;

  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    const position = pendingSelectionRef.current;
    if (position !== null && textareaRef.current) {
      textareaRef.current.setSelectionRange(position, position);
      pendingSelectionRef.current = null;
    }
  }, [code]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    pendingSelectionRef.current = selectionStart + INDENT.length;
    setDraft(
      value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd)
    );
  };

  const handleSave = useCallback(async () => {
    if (!storedFolderId) {
      toast.error('Select a destination folder first');
      return;
    }

    const folderId = storedFolderId;
    const name = buildBaseName(fileName) + PLANTUML_FILE_EXTENSION;
    const file = new File([code], name, { type: PLANTUML_MIME_TYPE });

    setIsSaving(true);
    try {
      await createFileNode(workspace.userId, folderId, file);
      toast.success(`Saved ${name}`, {
        action: {
          label: 'Open folder',
          onClick: () => {
            navigate({ to: '$nodeId', params: { nodeId: folderId } });
          },
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save the diagram'
      );
    } finally {
      setIsSaving(false);
    }
  }, [storedFolderId, fileName, code, workspace.userId, navigate]);

  const handleExportSvg = useCallback(async () => {
    setIsExporting(true);
    try {
      // Always export the light rendering, regardless of the app theme.
      const svg = await renderPlantUml(code);
      downloadBlob(
        new Blob([svg], { type: 'image/svg+xml' }),
        `${buildBaseName(fileName)}.svg`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to export the diagram'
      );
    } finally {
      setIsExporting(false);
    }
  }, [code, fileName]);

  return (
    <Container type="full" breadcrumb={<PlantUmlToolBreadcrumb />}>
      <div className="flex h-full flex-col gap-4 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex flex-col gap-2 md:w-56">
            <Label htmlFor="plantuml-file-name">File name</Label>
            <div className="flex items-center gap-1">
              <Input
                id="plantuml-file-name"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                placeholder={DEFAULT_FILE_NAME}
              />
              <span className="text-sm text-muted-foreground">
                {PLANTUML_FILE_EXTENSION}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 md:w-72">
            <Label>Destination folder</Label>
            <FolderSelect
              value={storedFolderId}
              onChange={setStoredFolderId}
              className="w-full"
            />
          </div>
          <div className="flex flex-row gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !storedFolderId}
            >
              {isSaving ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              Save as file
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportSvg}
              disabled={isExporting}
            >
              {isExporting ? (
                <Spinner className="size-4" />
              ) : (
                <FileDown className="size-4" />
              )}
              Export SVG
            </Button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="PlantUML code"
            className="min-h-80 w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:h-full dark:bg-input/30"
          />
          <div className="flex min-h-80 items-start justify-center overflow-auto rounded-md border border-input bg-background p-3 lg:h-full">
            <PlantUmlPreview code={code} debounceMs={300} />
          </div>
        </div>
      </div>
    </Container>
  );
};
