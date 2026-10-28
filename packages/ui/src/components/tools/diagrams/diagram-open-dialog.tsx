import { FileCode2, Lock } from 'lucide-react';
import { useMemo } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@colanode/ui/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import {
  DiagramFileOption,
  useDiagramFiles,
} from '@colanode/ui/lib/diagram-files';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';

interface DiagramOpenDialogProps {
  language: DiagramLanguage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: DiagramFileOption) => void;
  currentFileId?: string;
}

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
};

export const DiagramOpenDialog = ({
  language,
  open,
  onOpenChange,
  onSelect,
  currentFileId,
}: DiagramOpenDialogProps) => {
  const { files, isLoading } = useDiagramFiles(language);

  const groups = useMemo(() => {
    const result = new Map<string, DiagramFileOption[]>();
    for (const file of files) {
      const key = `${file.spaceName} / ${file.folderName}`;
      const group = result.get(key) ?? [];
      group.push(file);
      result.set(key, group);
    }
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Open a {language.name} file</DialogTitle>
          <DialogDescription>
            {language.name} files ({language.fileExtension}) stored in the
            folders of this workspace.
          </DialogDescription>
        </DialogHeader>
        <Command className="border-t">
          <CommandInput placeholder="Search by file or folder name..." />
          <CommandList className="max-h-96">
            {isLoading ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : (
              <CommandEmpty>
                No {language.name} file found. Save a diagram first.
              </CommandEmpty>
            )}
            {groups.map(([location, groupFiles]) => (
              <CommandGroup key={location} heading={location}>
                {groupFiles.map((file) => (
                  <CommandItem
                    key={file.id}
                    value={`${file.name} ${location} ${file.id}`}
                    onSelect={() => onSelect(file)}
                    className="flex items-center gap-2"
                  >
                    <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    {file.id === currentFileId && (
                      <span className="text-xs text-primary">(open)</span>
                    )}
                    {!file.canEdit && (
                      <Lock
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Read only"
                      />
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDate(file.updatedAt)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
