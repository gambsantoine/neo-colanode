import { useEffect, useState } from 'react';

import { FolderSelect } from '@colanode/ui/components/folders/folder-select';
import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Input } from '@colanode/ui/components/ui/input';
import { Label } from '@colanode/ui/components/ui/label';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import {
  DiagramFileOption,
  useDiagramFiles,
} from '@colanode/ui/lib/diagram-files';
import {
  DiagramLanguage,
  diagramLanguages,
} from '@colanode/ui/lib/diagram-languages';

export interface DiagramSaveTarget {
  baseName: string;
  folderId: string;
  // Existing file with the same name in the folder, replaced by the save.
  replace?: DiagramFileOption;
}

interface DiagramSaveDialogProps {
  language: DiagramLanguage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  defaultFolderId?: string;
  isSaving: boolean;
  onSave: (target: DiagramSaveTarget) => void;
}

// Strips the extension and characters that are invalid in file names.
export const buildBaseName = (name: string, fallback: string): string => {
  const base = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const lower = base.toLowerCase();
  const extension = diagramLanguages
    .flatMap((language) => language.fileExtensions)
    .find((item) => lower.endsWith(item));
  const stripped = (extension ? base.slice(0, -extension.length) : base).trim();
  return stripped.length > 0 ? stripped : fallback;
};

export const DiagramSaveDialog = ({
  language,
  open,
  onOpenChange,
  defaultName,
  defaultFolderId,
  isSaving,
  onSave,
}: DiagramSaveDialogProps) => {
  const { files } = useDiagramFiles(language);
  const [name, setName] = useState(defaultName);
  const [folderId, setFolderId] = useState(defaultFolderId);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setFolderId(defaultFolderId);
    }
  }, [open, defaultName, defaultFolderId]);

  const baseName = buildBaseName(name, defaultName);
  const fullName = baseName + language.fileExtension;
  const existing = folderId
    ? files.find(
        (file) =>
          file.parentId === folderId &&
          file.name.toLowerCase() === fullName.toLowerCase()
      )
    : undefined;
  const canReplace = existing?.canEdit ?? true;

  const submit = () => {
    if (!folderId || isSaving || !canReplace) {
      return;
    }

    onSave({ baseName, folderId, replace: existing });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as</DialogTitle>
          <DialogDescription>
            Save the diagram as a {language.fileExtension} file in a folder of
            the workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="plantuml-save-name">File name</Label>
            <div className="flex items-center gap-1">
              <Input
                id="plantuml-save-name"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">
                {language.fileExtension}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Folder</Label>
            <FolderSelect
              value={folderId}
              onChange={setFolderId}
              className="w-full"
            />
          </div>
          {existing && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {canReplace
                ? `${existing.name} already exists in this folder and will be replaced.`
                : `${existing.name} already exists in this folder and you are not allowed to replace it.`}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!folderId || isSaving || !canReplace}
            >
              {isSaving && <Spinner className="size-4" />}
              {existing ? 'Replace' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
