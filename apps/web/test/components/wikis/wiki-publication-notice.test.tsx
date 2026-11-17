import { describe, expect, it, vi } from 'vitest';

import { LocalNode } from '@colanode/client/types';
import {
  findSensitiveFields,
  WikiPublicationNotice,
} from '@colanode/ui/components/wikis/wiki-publication-notice';

import { customRender, screen } from '../../test-utils';

const state = vi.hoisted(() => ({ nodes: [] as unknown[] }));

vi.mock('@colanode/ui/contexts/workspace', () => ({
  useWorkspace: () => ({ userId: 'user1', collections: { nodes: {} } }),
}));

vi.mock('@tanstack/react-db', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  useLiveQuery: () => ({ data: state.nodes }),
}));

const database = (name: string, fields: Record<string, unknown>) =>
  ({ id: name, type: 'database', name, fields }) as unknown as LocalNode;

const contacts = database('Contacts', {
  f1: { id: 'f1', type: 'email', name: 'Email', index: 'a0' },
  f2: { id: 'f2', type: 'phone', name: 'Mobile', index: 'a1' },
  f3: { id: 'f3', type: 'text', name: 'Notes', index: 'a2' },
});

describe('findSensitiveFields', () => {
  it('lists the email and phone fields of databases only', () => {
    expect(
      findSensitiveFields([
        contacts,
        database('', {
          f: { id: 'f', type: 'email', name: 'Mail', index: 'a0' },
        }),
        { id: 'p', type: 'page', name: 'Page' } as unknown as LocalNode,
        { id: 'd', type: 'database', name: 'Empty' } as unknown as LocalNode,
      ])
    ).toEqual([
      { databaseName: 'Contacts', fieldName: 'Email', kind: 'email' },
      { databaseName: 'Contacts', fieldName: 'Mobile', kind: 'phone' },
      { databaseName: 'Untitled', fieldName: 'Mail', kind: 'email' },
    ]);
  });
});

describe('components/wikis/WikiPublicationNotice', () => {
  it('explains what becomes public', () => {
    state.nodes = [];
    customRender(<WikiPublicationNotice wikiId="wiki1" />);

    expect(screen.getByText('What readers will see')).toBeInTheDocument();
    expect(screen.queryByText(/email addresses or phone numbers/)).toBeNull();
  });

  it('warns about contact fields', () => {
    state.nodes = [contacts];
    customRender(<WikiPublicationNotice wikiId="wiki1" />);

    expect(
      screen.getByText(/email addresses or phone numbers/)
    ).toBeInTheDocument();
    expect(screen.getByText('Email (email) in Contacts')).toBeInTheDocument();
    expect(screen.getByText('Mobile (phone) in Contacts')).toBeInTheDocument();
  });
});
