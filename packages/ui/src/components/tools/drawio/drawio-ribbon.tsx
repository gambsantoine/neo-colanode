import {
  CloudUpload,
  FileImage,
  FilePlus2,
  FolderOpen,
  ImageDown,
  Save,
  SaveAll,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

import {
  Ribbon,
  RibbonButton,
  RibbonGroup,
} from '@colanode/ui/components/tools/ribbon';

interface DrawioRibbonProps {
  fileName: string;
  location: string | null;
  isDirty: boolean;
  isReadOnly: boolean;
  isBusy: boolean;
  canExport: boolean;
  onNew: () => void;
  onOpen: () => void;
  onImport: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
}

export const DrawioRibbon = ({
  fileName,
  location,
  isDirty,
  isReadOnly,
  isBusy,
  canExport,
  onNew,
  onOpen,
  onImport,
  onSave,
  onSaveAs,
  onExportSvg,
  onExportPng,
}: DrawioRibbonProps) => {
  const [tab, setTab] = useState('file');

  return (
    <Ribbon
      value={tab}
      onValueChange={setTab}
      tabs={[
        {
          id: 'file',
          label: 'File',
          content: (
            <>
              <RibbonGroup label="Document">
                <RibbonButton
                  size="lg"
                  label="New"
                  icon={FilePlus2}
                  onClick={onNew}
                  disabled={isBusy}
                />
                <RibbonButton
                  size="lg"
                  label="Open"
                  icon={FolderOpen}
                  onClick={onOpen}
                  disabled={isBusy}
                />
                <RibbonButton
                  size="lg"
                  label="Import"
                  icon={Upload}
                  tooltip="Import a .drawio file from this computer"
                  onClick={onImport}
                  disabled={isBusy}
                />
              </RibbonGroup>
              <RibbonGroup label="Save">
                <RibbonButton
                  size="lg"
                  label="Save"
                  icon={Save}
                  shortcut="Ctrl+S"
                  tooltip={
                    isReadOnly
                      ? 'This file is read-only, use Save as'
                      : 'Save to the workspace'
                  }
                  onClick={onSave}
                  disabled={isBusy || isReadOnly || !canExport}
                />
                <RibbonButton
                  size="lg"
                  label="Save as"
                  icon={SaveAll}
                  onClick={onSaveAs}
                  disabled={isBusy || !canExport}
                />
              </RibbonGroup>
              <RibbonGroup label="Export">
                <RibbonButton
                  size="lg"
                  label="SVG"
                  icon={FileImage}
                  onClick={onExportSvg}
                  disabled={isBusy || !canExport}
                />
                <RibbonButton
                  size="lg"
                  label="PNG"
                  icon={ImageDown}
                  onClick={onExportPng}
                  disabled={isBusy || !canExport}
                />
              </RibbonGroup>
            </>
          ),
        },
      ]}
      status={
        <>
          {isDirty && <CloudUpload className="size-3.5 shrink-0" />}
          <span className="truncate">
            {fileName}
            {location && ` · ${location}`}
            {isDirty && ' (unsaved)'}
          </span>
        </>
      }
    />
  );
};
