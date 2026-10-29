import { inArray, useLiveQuery } from '@tanstack/react-db';
import { useMemo } from 'react';

import { DownloadStatus, LocalNode } from '@colanode/client/types';
import { extractNodeRole, FileStatus, hasNodeRole } from '@colanode/core';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  DiagramLanguage,
  isDiagramFileName,
} from '@colanode/ui/lib/diagram-languages';
import { createFileNode } from '@colanode/ui/lib/files';

// Diagram sources are saved as plain text files.
export const DIAGRAM_MIME_TYPE = 'text/plain';

// Metadata keys of a diagram editor (namespace: workspace user id), e.g.
// `tools.plantuml.draft`.
export const getDiagramMetadataKeys = (language: DiagramLanguage) => ({
  draft: `tools.${language.id}.draft`,
  folderId: `tools.${language.id}.folderId`,
  file: `tools.${language.id}.file`,
  savedCode: `tools.${language.id}.savedCode`,
  // Set by other views to ask the editor to open a file.
  pendingFileId: `tools.${language.id}.pendingFileId`,
});

const READ_POLL_INTERVAL_MS = 300;
const READ_TIMEOUT_MS = 30_000;

export interface DiagramFileOption {
  id: string;
  name: string;
  parentId: string;
  folderName: string;
  spaceName: string;
  updatedAt: string;
  canEdit: boolean;
}

// Lists every file of the language stored in a folder of the workspace, most
// recently updated first.
export const useDiagramFiles = (
  language: DiagramLanguage
): {
  files: DiagramFileOption[];
  isLoading: boolean;
} => {
  const workspace = useWorkspace();

  const nodesQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => inArray(nodes.type, ['file', 'folder', 'space']))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );

  const files = useMemo(() => {
    const nodes = nodesQuery.data as LocalNode[];
    const containers = new Map<string, LocalNode>();
    for (const node of nodes) {
      if (node.type === 'folder' || node.type === 'space') {
        containers.set(node.id, node);
      }
    }

    const options: DiagramFileOption[] = [];
    for (const node of nodes) {
      if (node.type !== 'file' || !isDiagramFileName(language, node.name)) {
        continue;
      }

      const folder = containers.get(node.parentId);
      if (!folder || folder.type !== 'folder') {
        continue;
      }

      const space = containers.get(node.rootId);
      const tree = space ? [space, folder] : [folder];
      const role = extractNodeRole(tree, workspace.userId);
      if (!role) {
        continue;
      }

      options.push({
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        folderName: folder.name || 'Untitled',
        spaceName:
          space && space.type === 'space' ? space.name : 'Unknown space',
        updatedAt: node.updatedAt ?? node.createdAt,
        canEdit: hasNodeRole(role, 'editor'),
      });
    }

    return options.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [nodesQuery.data, workspace.userId, language]);

  return { files, isLoading: nodesQuery.isLoading };
};

// Reads the text content of a file node, downloading it first when it is not
// available locally yet.
export const readDiagramFile = async (
  userId: string,
  fileId: string
): Promise<string> => {
  const deadline = Date.now() + READ_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const localFile = await window.colanode.executeQuery({
      type: 'local.file.get',
      fileId,
      userId,
      autoDownload: true,
    });

    if (localFile?.downloadStatus === DownloadStatus.Failed) {
      throw new Error(
        localFile.downloadErrorMessage ?? 'The file could not be downloaded'
      );
    }

    if (
      localFile?.downloadStatus === DownloadStatus.Completed &&
      localFile.url
    ) {
      const response = await fetch(localFile.url);
      if (!response.ok) {
        throw new Error('The file could not be read');
      }

      return await response.text();
    }

    if (!localFile) {
      const node = await getFileNode(userId, fileId);
      if (!node) {
        throw new Error('The file no longer exists');
      }

      if (node.type === 'file' && node.status !== FileStatus.Ready) {
        throw new Error('The file has not been uploaded yet');
      }
    }

    await new Promise((resolve) => setTimeout(resolve, READ_POLL_INTERVAL_MS));
  }

  throw new Error('Timed out while downloading the file');
};

const getFileNode = async (
  userId: string,
  fileId: string
): Promise<LocalNode | undefined> => {
  const nodes = await window.colanode.executeQuery({
    type: 'node.list',
    userId,
    filters: [{ field: ['id'], operator: 'eq', value: fileId }],
    sorts: [],
    limit: 1,
  });

  return nodes[0];
};

export const buildDiagramFile = (
  language: DiagramLanguage,
  baseName: string,
  code: string
): File =>
  new File([code], baseName + language.fileExtension, {
    type: DIAGRAM_MIME_TYPE,
  });

// Files are immutable once uploaded: saving over an existing file creates a
// new file node in the same folder and deletes the previous one.
export const replaceDiagramFile = async (
  userId: string,
  previousFileId: string,
  parentId: string,
  file: File
): Promise<{ fileId: string; deleteError: string | null }> => {
  const fileId = await createFileNode(userId, parentId, file);

  const result = await window.colanode.executeMutation({
    type: 'node.delete',
    userId,
    nodeId: previousFileId,
  });

  return {
    fileId,
    deleteError: result.success ? null : result.error.message,
  };
};
