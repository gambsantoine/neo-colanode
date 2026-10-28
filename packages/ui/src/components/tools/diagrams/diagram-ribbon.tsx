import {
  Code,
  Columns2,
  Copy,
  FileCode2,
  FileDown,
  FileImage,
  FilePlus,
  FolderOpen,
  FolderSymlink,
  ImageDown,
  IndentDecrease,
  IndentIncrease,
  Lock,
  Maximize,
  MessageSquareCode,
  Redo2,
  Save,
  SaveAll,
  Scan,
  Upload,
  Undo2,
  ZoomIn,
  ZoomOut,
  Eye,
} from 'lucide-react';
import { ReactNode, useState } from 'react';

import {
  Ribbon,
  RibbonButton,
  RibbonGroup,
} from '@colanode/ui/components/tools/ribbon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@colanode/ui/components/ui/dropdown-menu';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';

export type DiagramLayout = 'split' | 'code' | 'preview';

export interface DiagramRibbonProps {
  language: DiagramLanguage;
  fileName: string;
  location: string | null;
  isDirty: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  isLoadingFile: boolean;
  isExporting: boolean;
  canOpenFolder: boolean;
  layout: DiagramLayout;
  // undefined: fit to the available width.
  zoom: number | undefined;
  onNew: (code?: string) => void;
  onOpen: () => void;
  onImport: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFolder: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onDownloadSource: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleComment: () => void;
  onDuplicate: () => void;
  onInsertSnippet: (code: string) => void;
  onLayoutChange: (layout: DiagramLayout) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number | undefined) => void;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

export const DiagramRibbon = (props: DiagramRibbonProps) => {
  const [tab, setTab] = useState('file');

  const status: ReactNode = (
    <>
      {props.isLoadingFile ? (
        <Spinner className="size-4 shrink-0" />
      ) : (
        <FileCode2 className="size-4 shrink-0" />
      )}
      <span className="truncate font-medium text-foreground">
        {props.fileName}
      </span>
      {props.location && (
        <span className="hidden truncate lg:inline">— {props.location}</span>
      )}
      {props.isReadOnly && (
        <span className="flex shrink-0 items-center gap-1 text-xs">
          <Lock className="size-3" /> Read only
        </span>
      )}
      <span
        className={
          props.isDirty
            ? 'flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-400'
            : 'flex shrink-0 items-center gap-1 text-xs'
        }
      >
        <span
          className={
            props.isDirty
              ? 'size-2 rounded-full bg-amber-500'
              : 'size-2 rounded-full bg-emerald-500'
          }
        />
        {props.isDirty ? 'Unsaved changes' : 'Saved'}
      </span>
    </>
  );

  return (
    <Ribbon
      value={tab}
      onValueChange={setTab}
      status={status}
      tabs={[
        {
          id: 'file',
          label: 'File',
          content: (
            <>
              <RibbonGroup label="New">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <RibbonButton size="lg" icon={FilePlus} label="New" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => props.onNew()}>
                      Blank diagram
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      From a template
                    </DropdownMenuLabel>
                    {props.language.templates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => props.onNew(template.code)}
                      >
                        {template.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </RibbonGroup>
              <RibbonGroup label="Open">
                <RibbonButton
                  size="lg"
                  icon={FolderOpen}
                  label="Open"
                  tooltip={`Open a ${props.language.fileExtension} file of the workspace`}
                  shortcut={`${mod}O`}
                  onClick={props.onOpen}
                  disabled={props.isLoadingFile}
                />
                <div className="flex flex-col justify-center gap-0.5">
                  <RibbonButton
                    icon={Upload}
                    label="Import"
                    tooltip={`Import a ${props.language.fileExtension} file from this computer`}
                    onClick={props.onImport}
                  />
                  <RibbonButton
                    icon={FolderSymlink}
                    label="Go to folder"
                    onClick={props.onOpenFolder}
                    disabled={!props.canOpenFolder}
                  />
                </div>
              </RibbonGroup>
              <RibbonGroup label="Save">
                <RibbonButton
                  size="lg"
                  icon={Save}
                  label={props.isSaving ? 'Saving…' : 'Save'}
                  tooltip={
                    props.isReadOnly
                      ? 'Read only: save a copy with Save as'
                      : 'Save in the workspace'
                  }
                  shortcut={`${mod}S`}
                  onClick={props.onSave}
                  disabled={props.isSaving}
                />
                <div className="flex flex-col justify-center gap-0.5">
                  <RibbonButton
                    icon={SaveAll}
                    label="Save as"
                    shortcut={`${mod}Shift+S`}
                    onClick={props.onSaveAs}
                    disabled={props.isSaving}
                  />
                </div>
              </RibbonGroup>
              <RibbonGroup label="Export" compact>
                <RibbonButton
                  icon={FileImage}
                  label="SVG image"
                  onClick={props.onExportSvg}
                  disabled={props.isExporting}
                />
                <RibbonButton
                  icon={ImageDown}
                  label="PNG image"
                  onClick={props.onExportPng}
                  disabled={props.isExporting}
                />
                <RibbonButton
                  icon={FileDown}
                  label={`Source (${props.language.fileExtension})`}
                  onClick={props.onDownloadSource}
                />
              </RibbonGroup>
            </>
          ),
        },
        {
          id: 'home',
          label: 'Home',
          content: (
            <>
              <RibbonGroup label="History">
                <RibbonButton
                  size="lg"
                  icon={Undo2}
                  label="Undo"
                  shortcut={`${mod}Z`}
                  onClick={props.onUndo}
                />
                <RibbonButton
                  size="lg"
                  icon={Redo2}
                  label="Redo"
                  shortcut={isMac ? '⌘Shift+Z' : 'Ctrl+Y'}
                  onClick={props.onRedo}
                />
              </RibbonGroup>
              <RibbonGroup label="Lines" compact>
                <RibbonButton
                  icon={IndentIncrease}
                  label="Indent"
                  shortcut="Tab"
                  onClick={props.onIndent}
                />
                <RibbonButton
                  icon={IndentDecrease}
                  label="Outdent"
                  shortcut="Shift+Tab"
                  onClick={props.onOutdent}
                />
                <RibbonButton
                  icon={MessageSquareCode}
                  label="Comment"
                  shortcut={`${mod}/`}
                  onClick={props.onToggleComment}
                />
                <RibbonButton
                  icon={Copy}
                  label="Duplicate"
                  onClick={props.onDuplicate}
                />
              </RibbonGroup>
            </>
          ),
        },
        {
          id: 'insert',
          label: 'Insert',
          content: (
            <>
              {props.language.snippetGroups.map((group) => (
                <RibbonGroup key={group.id} label={group.label} compact>
                  {group.snippets.map((snippet) => (
                    <RibbonButton
                      key={snippet.id}
                      label={snippet.label}
                      tooltip={snippet.code.replace('$0', '…')}
                      onClick={() => props.onInsertSnippet(snippet.code)}
                    />
                  ))}
                </RibbonGroup>
              ))}
            </>
          ),
        },
        {
          id: 'view',
          label: 'View',
          content: (
            <>
              <RibbonGroup label="Layout">
                <RibbonButton
                  size="lg"
                  icon={Columns2}
                  label="Split"
                  active={props.layout === 'split'}
                  onClick={() => props.onLayoutChange('split')}
                />
                <RibbonButton
                  size="lg"
                  icon={Code}
                  label="Code"
                  active={props.layout === 'code'}
                  onClick={() => props.onLayoutChange('code')}
                />
                <RibbonButton
                  size="lg"
                  icon={Eye}
                  label="Preview"
                  active={props.layout === 'preview'}
                  onClick={() => props.onLayoutChange('preview')}
                />
              </RibbonGroup>
              <RibbonGroup label="Zoom">
                <RibbonButton
                  size="lg"
                  icon={ZoomOut}
                  label="Zoom out"
                  onClick={props.onZoomOut}
                />
                <div className="flex min-w-14 flex-col items-center justify-center text-xs tabular-nums">
                  {props.zoom === undefined
                    ? 'Fit'
                    : `${Math.round(props.zoom * 100)}%`}
                </div>
                <RibbonButton
                  size="lg"
                  icon={ZoomIn}
                  label="Zoom in"
                  onClick={props.onZoomIn}
                />
                <div className="flex flex-col justify-center gap-0.5">
                  <RibbonButton
                    icon={Maximize}
                    label="Fit width"
                    active={props.zoom === undefined}
                    onClick={() => props.onZoomChange(undefined)}
                  />
                  <RibbonButton
                    icon={Scan}
                    label="100%"
                    active={props.zoom === 1}
                    onClick={() => props.onZoomChange(1)}
                  />
                </div>
              </RibbonGroup>
            </>
          ),
        },
      ]}
    />
  );
};
