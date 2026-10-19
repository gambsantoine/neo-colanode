import { Editor } from '@tiptap/react';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { LocalNode } from '@colanode/client/types';
import { collections } from '@colanode/ui/collections';
import { useApp } from '@colanode/ui/contexts/app';
import { useContainer } from '@colanode/ui/contexts/container';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  buildPdfHtml,
  PdfExportResolver,
  serializeEditorForPdf,
} from '@colanode/ui/lib/export';

interface DocumentActionsBarProps {
  editor: Editor;
  node: LocalNode;
}

const getNodeName = (node: LocalNode | undefined): string | undefined => {
  if (node && 'name' in node && typeof node.name === 'string') {
    return node.name || undefined;
  }

  return undefined;
};

export const DocumentActionsBar = ({
  editor,
  node,
}: DocumentActionsBarProps) => {
  const app = useApp();
  const workspace = useWorkspace();
  const { actionsSlot } = useContainer();
  const [isExporting, setIsExporting] = useState(false);

  if (app.type === 'mobile' || !actionsSlot) {
    return null;
  }

  const handleExportPdf = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const resolver: PdfExportResolver = {
        getNodeName: (id) => getNodeName(workspace.collections.nodes.get(id)),
        getUserName: (id) => workspace.collections.users.get(id)?.name,
        getTempFileName: (id) => collections.tempFiles.get(id)?.name,
      };

      const nodeName = getNodeName(node);
      const content = await serializeEditorForPdf(editor, resolver);
      const html = buildPdfHtml(nodeName ?? 'Document', content);

      const result = await window.colanode.exportToPdf({
        html,
        fileName: nodeName ?? 'document',
      });

      switch (result.status) {
        case 'saved':
          toast.success('PDF exported');
          window.colanode.showItemInFolder(result.filePath);
          break;
        case 'failed':
          toast.error(
            result.error
              ? `Failed to export PDF: ${result.error}`
              : 'Failed to export PDF'
          );
          break;
        case 'print-dialog':
        case 'cancelled':
          break;
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Failed to export PDF: ${error.message}`
          : 'Failed to export PDF'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <button
      type="button"
      onClick={handleExportPdf}
      disabled={isExporting}
      aria-label="Export as PDF"
      title="Export as PDF"
      className="flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-50"
    >
      <FileDown className="size-4" />
    </button>,
    actionsSlot
  );
};
