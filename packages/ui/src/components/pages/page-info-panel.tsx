import { eq, useLiveQuery } from '@tanstack/react-db';
import { Check, Copy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';


import { LocalNode, LocalPageNode } from '@colanode/client/types';
import {
  extractDocumentText,
  extractNodeName,
  formatDate,
  slugify,
} from '@colanode/core';
import { NodeCollaboratorAudit } from '@colanode/ui/components/collaborators/node-collaborator-audit';
import { PageTagsEditor } from '@colanode/ui/components/pages/page-tags-editor';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { useDebouncedValue } from '@colanode/ui/hooks/use-debounced-value';
import { useLiveQuery as useColanodeLiveQuery } from '@colanode/ui/hooks/use-live-query';
import { usePageUpdate } from '@colanode/ui/hooks/use-page-update';

const WORDS_PER_MINUTE = 200;

export interface PageStats {
  words: number;
  characters: number;
  readingMinutes: number;
}

export const computePageStats = (text: string | null): PageStats => {
  const value = text ?? '';
  const words = value.split(/\s+/).filter((word) => word.length > 0).length;
  const characters = value.replace(/\s/g, '').length;
  const readingMinutes =
    words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));

  return { words, characters, readingMinutes };
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </section>
);

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-2 text-sm">
    <span className="text-muted-foreground pt-0.5">{label}</span>
    <div className="min-w-0">{children}</div>
  </div>
);

interface PageInfoPanelProps {
  page: LocalPageNode;
  // Ancestors of the page, from its space or wiki down to its parent.
  location: LocalNode[];
  root: LocalNode | null;
  canEdit: boolean;
  onClose: () => void;
}

const STATS_DELAY_MS = 600;

export const PageInfoPanel = ({
  page,
  location,
  root,
  canEdit,
  onClose,
}: PageInfoPanelProps) => {
  const workspace = useWorkspace();
  const updatePage = usePageUpdate(page.id);
  const [slug, setSlug] = useState(page.slug ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => setSlug(page.slug ?? ''), [page.slug]);

  // Only the direct children are needed, to count the sub pages.
  const childrenQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.parentId, page.id)),
    [workspace.userId, page.id]
  );

  const documentQuery = useColanodeLiveQuery({
    type: 'document.get',
    documentId: page.id,
    userId: workspace.userId,
  });

  const isWikiPage = root?.type === 'wiki';
  const subpages = (childrenQuery.data as LocalNode[]).filter(
    (node) => node.type === 'page'
  ).length;

  // Counting words walks the whole document: wait for a pause in typing.
  const document = useDebouncedValue(documentQuery.data, STATS_DELAY_MS);
  const stats = useMemo(() => {
    const text =
      document && document.content.type === 'rich_text'
        ? extractDocumentText(page.id, document.content)
        : null;
    return computePageStats(text);
  }, [document, page.id]);

  const saveSlug = () => {
    const value = slugify(slug);
    const next =
      value.length > 0 && value !== slugify(page.name) ? value : null;
    setSlug(next ?? '');
    if (next !== (page.slug ?? null)) {
      updatePage((draft) => {
        draft.slug = next;
      });
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(page.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The id stays selectable.
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Page info</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close page info"
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <Section title="Properties">
        <Row label="Tags">
          <PageTagsEditor page={page} canEdit={canEdit} />
          {!canEdit && (page.tags?.length ?? 0) === 0 && (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        {isWikiPage && (canEdit || page.slug) && (
          <Row label="Wiki address">
            <div className="flex items-center font-mono text-xs">
              <span className="text-muted-foreground">…/</span>
              <input
                value={slug}
                readOnly={!canEdit}
                aria-label="Page address in the wiki"
                placeholder={slugify(page.name) || 'page'}
                onChange={(event) => setSlug(event.target.value)}
                onBlur={saveSlug}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                className="w-full rounded-sm bg-transparent px-1 outline-none hover:bg-accent focus:bg-accent placeholder:text-muted-foreground"
              />
            </div>
          </Row>
        )}
      </Section>

      <Section title="Location">
        <p className="text-sm break-words">
          {location.length === 0
            ? 'Unknown'
            : location
                .map((node) => extractNodeName(node) || 'Untitled')
                .join(' › ')}
        </p>
        {root && (
          <span className="text-xs text-muted-foreground">
            {root.type === 'wiki' ? 'Wiki' : 'Space'}
          </span>
        )}
      </Section>

      <Section title="Activity">
        <Row label="Created">
          <div className="flex flex-col gap-1">
            <NodeCollaboratorAudit
              collaboratorId={page.createdBy}
              date={page.createdAt}
            />
            <span className="text-xs text-muted-foreground">
              {formatDate(page.createdAt)}
            </span>
          </div>
        </Row>
        {page.updatedBy && page.updatedAt && (
          <Row label="Last edited">
            <div className="flex flex-col gap-1">
              <NodeCollaboratorAudit
                collaboratorId={page.updatedBy}
                date={page.updatedAt}
              />
              <span className="text-xs text-muted-foreground">
                {formatDate(page.updatedAt)}
              </span>
            </div>
          </Row>
        )}
      </Section>

      <Section title="Content">
        <Row label="Words">
          <span className="tabular-nums">{stats.words}</span>
        </Row>
        <Row label="Characters">
          <span className="tabular-nums">{stats.characters}</span>
        </Row>
        <Row label="Reading time">
          <span className="tabular-nums">
            {stats.readingMinutes === 0 ? '—' : `${stats.readingMinutes} min`}
          </span>
        </Row>
        <Row label="Sub pages">
          <span className="tabular-nums">{subpages}</span>
        </Row>
      </Section>

      <Section title="Identifier">
        <div className="flex items-center gap-2">
          <code className="min-w-0 truncate text-xs text-muted-foreground select-all">
            {page.id}
          </code>
          <button
            type="button"
            onClick={copyId}
            aria-label="Copy page id"
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </Section>
    </div>
  );
};
