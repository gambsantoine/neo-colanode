import { describe, expect, it, vi, beforeEach } from 'vitest';

import { LocalNode, LocalPageNode } from '@colanode/client/types';
import {
  computePageStats,
  PageInfoPanel,
} from '@colanode/ui/components/pages/page-info-panel';

import { customRender, fireEvent, screen } from '../../test-utils';

const state = vi.hoisted(() => ({
  nodes: [] as unknown[],
  document: null as unknown,
  updates: [] as Record<string, unknown>[],
}));

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'user1', collections: { nodes: {} } }),
}));

vi.mock('@tanstack/react-db', () => ({
  eq: vi.fn(),
  useLiveQuery: () => ({ data: state.nodes }),
}));

vi.mock('@colanode/ui/hooks/use-live-query', () => ({
  useLiveQuery: () => ({ data: state.document, isPending: false }),
}));

vi.mock('@colanode/ui/hooks/use-debounced-value', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock('@colanode/ui/hooks/use-page-update', () => ({
  usePageUpdate: () => (update: (draft: Record<string, unknown>) => void) => {
    const draft: Record<string, unknown> = {};
    update(draft);
    state.updates.push(draft);
  },
}));

vi.mock(
  '@colanode/ui/components/collaborators/node-collaborator-audit',
  () => ({
    NodeCollaboratorAudit: ({ collaboratorId }: { collaboratorId: string }) => (
      <span>user:{collaboratorId}</span>
    ),
  })
);

const node = (values: Record<string, unknown>) => ({
  createdAt: '2026-01-01T10:00:00.000Z',
  createdBy: 'user1',
  updatedAt: null,
  updatedBy: null,
  ...values,
});

const page = node({
  id: 'page1',
  type: 'page',
  name: 'Getting started',
  parentId: 'cat1',
  rootId: 'wiki1',
  tags: ['guide'],
  updatedAt: '2026-02-01T10:00:00.000Z',
  updatedBy: 'user2',
}) as unknown as LocalPageNode;

const wikiRoot = node({
  id: 'wiki1',
  type: 'wiki',
  name: 'Docs',
  parentId: null,
  rootId: 'wiki1',
});
const spaceRoot = { ...wikiRoot, type: 'space' };
const category = node({
  id: 'cat1',
  type: 'category',
  name: 'Guides',
  parentId: 'wiki1',
  rootId: 'wiki1',
});

const renderPanel = (
  props: Partial<React.ComponentProps<typeof PageInfoPanel>> = {}
) => {
  const root = (props.root ?? wikiRoot) as LocalNode;
  return customRender(
    <PageInfoPanel
      page={page}
      location={[root, category] as LocalNode[]}
      root={root}
      canEdit
      onClose={vi.fn()}
      {...props}
    />
  );
};

describe('computePageStats', () => {
  it('counts words, characters and reading time', () => {
    expect(computePageStats(null)).toEqual({
      words: 0,
      characters: 0,
      readingMinutes: 0,
    });
    expect(computePageStats('Hello  world\nagain')).toEqual({
      words: 3,
      characters: 15,
      readingMinutes: 1,
    });
    expect(
      computePageStats(Array(1000).fill('word').join(' ')).readingMinutes
    ).toBe(5);
  });
});

describe('components/pages/PageInfoPanel', () => {
  beforeEach(() => {
    state.updates = [];
    state.document = {
      content: {
        type: 'rich_text',
        blocks: {
          b1: {
            id: 'b1',
            type: 'paragraph',
            parentId: 'page1',
            index: 'a0',
            content: [{ type: 'text', text: 'One two three' }],
          },
        },
      },
    };
    // Direct children of the page: one sub page and one file.
    state.nodes = [
      node({ id: 'sub1', type: 'page', name: 'Sub', parentId: 'page1' }),
      node({ id: 'f1', type: 'file', name: 'a.png', parentId: 'page1' }),
    ];
  });

  it('shows location, activity, content stats and sub pages', () => {
    renderPanel();

    expect(screen.getByText('Docs › Guides')).toBeInTheDocument();
    expect(screen.getByText('Wiki')).toBeInTheDocument();
    expect(screen.getByText('user:user1')).toBeInTheDocument();
    expect(screen.getByText('user:user2')).toBeInTheDocument();
    expect(screen.getByText('#guide')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1 min')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('page1')).toBeInTheDocument();
  });

  it('edits the wiki address only for wiki pages', () => {
    renderPanel();
    const input = screen.getByLabelText('Page address in the wiki');

    fireEvent.change(input, { target: { value: 'Premiers Pas' } });
    fireEvent.blur(input);
    expect(state.updates).toEqual([{ slug: 'premiers-pas' }]);
  });

  it('hides the wiki address in a space', () => {
    renderPanel({ root: spaceRoot as LocalNode });

    expect(screen.queryByLabelText('Page address in the wiki')).toBeNull();
    expect(screen.getByText('Space')).toBeInTheDocument();
  });

  it('hides an unset wiki address from readers', () => {
    renderPanel({
      page: { ...page, tags: [] } as LocalPageNode,
      canEdit: false,
    });

    expect(screen.queryByLabelText('Page address in the wiki')).toBeNull();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('shows a set wiki address to readers, read only', () => {
    renderPanel({
      page: { ...page, slug: 'start' } as LocalPageNode,
      canEdit: false,
    });

    expect(screen.getByLabelText('Page address in the wiki')).toHaveAttribute(
      'readonly'
    );
  });

  it('closes', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByLabelText('Close page info'));
    expect(onClose).toHaveBeenCalled();
  });
});
