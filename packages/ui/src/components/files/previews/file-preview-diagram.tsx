import { useNavigate } from '@tanstack/react-router';
import { Code, Eye, PencilRuler } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DiagramPreview } from '@colanode/ui/components/diagrams/diagram-preview';
import { Button } from '@colanode/ui/components/ui/button';
import { Spinner } from '@colanode/ui/components/ui/spinner';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useMetadata } from '@colanode/ui/hooks/use-metadata';
import { getDiagramMetadataKeys } from '@colanode/ui/lib/diagram-files';
import { DiagramLanguage } from '@colanode/ui/lib/diagram-languages';

interface FilePreviewDiagramProps {
  language: DiagramLanguage;
  fileId: string;
  url: string;
}

type ContentState =
  | { status: 'loading' }
  | { status: 'ready'; code: string }
  | { status: 'error'; message: string };

export const FilePreviewDiagram = ({
  language,
  fileId,
  url,
}: FilePreviewDiagramProps) => {
  const workspace = useWorkspace();
  const navigate = useNavigate({ from: '/workspace/$userId' });
  const [, setPendingFileId] = useMetadata<string>(
    workspace.userId,
    getDiagramMetadataKeys(language).pendingFileId
  );
  const [content, setContent] = useState<ContentState>({ status: 'loading' });
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent({ status: 'loading' });

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error('The file could not be read');
        }
        return response.text();
      })
      .then((code) => {
        if (!cancelled) {
          setContent({ status: 'ready', code });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setContent({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to read file',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const openInEditor = () => {
    setPendingFileId(fileId);
    navigate({ to: language.toolPath });
  };

  if (content.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (content.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {content.message}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCode((value) => !value)}
        >
          {showCode ? <Eye className="size-4" /> : <Code className="size-4" />}
          {showCode ? 'Show diagram' : 'Show code'}
        </Button>
        <Button type="button" size="sm" onClick={openInEditor}>
          <PencilRuler className="size-4" />
          Edit in {language.name} editor
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto rounded-md border border-input bg-background p-4">
        {showCode ? (
          <pre className="w-full font-mono text-sm whitespace-pre-wrap">
            {content.code}
          </pre>
        ) : (
          <div className="m-auto">
            <DiagramPreview language={language} code={content.code} />
          </div>
        )}
      </div>
    </div>
  );
};
