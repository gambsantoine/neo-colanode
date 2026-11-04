import { FileStatus } from '@colanode/core';
import { SelectNode } from '@colanode/server/data/schema';

// A tiny in-memory stand-in for the Kysely query builder: only the calls made
// by the wiki code are supported. Rows are plain objects keyed by table name.

type Row = Record<string, unknown>;
type Where = { column: string; op: string; value: unknown };

export interface FakeQuery {
  kind: 'select' | 'update' | 'insert' | 'delete';
  table: string;
  wheres: Where[];
  set?: Row;
  values?: Row[];
  conflictColumns?: string[];
  conflictSet?: Record<string, unknown>;
}

export const tables: Record<string, Row[]> = {};
export const queries: FakeQuery[] = [];

// Called before every query; throw from it to simulate a database error.
export const dbHooks: { beforeExecute: ((query: FakeQuery) => void) | null } = {
  beforeExecute: null,
};

export const resetDatabase = (data: Record<string, Row[]> = {}) => {
  for (const key of Object.keys(tables)) {
    delete tables[key];
  }
  for (const [key, rows] of Object.entries(data)) {
    tables[key] = rows.map((row) => ({ ...row }));
  }
  queries.length = 0;
  dbHooks.beforeExecute = null;
};

const columnName = (column: string) => column.split('.').pop()!;

const matches = (row: Row, wheres: Where[]) =>
  wheres.every(({ column, op, value }) => {
    const current = row[columnName(column)];
    if (op === 'in') {
      return (value as unknown[]).includes(current);
    }
    return current === value;
  });

const run = (query: FakeQuery): Row[] => {
  queries.push(query);
  dbHooks.beforeExecute?.(query);

  const rows = (tables[query.table] ??= []);
  switch (query.kind) {
    case 'select':
      return rows.filter((row) => matches(row, query.wheres));
    case 'update': {
      const updated = rows.filter((row) => matches(row, query.wheres));
      for (const row of updated) {
        Object.assign(row, query.set);
      }
      return updated;
    }
    case 'delete': {
      const removed = rows.filter((row) => matches(row, query.wheres));
      tables[query.table] = rows.filter((row) => !removed.includes(row));
      return removed;
    }
    case 'insert': {
      const result: Row[] = [];
      for (const value of query.values ?? []) {
        const existing = query.conflictColumns
          ? rows.find((row) =>
              query.conflictColumns!.every((col) => row[col] === value[col])
            )
          : undefined;
        if (existing) {
          for (const [key, update] of Object.entries(query.conflictSet ?? {})) {
            existing[key] =
              typeof update === 'string' && update.startsWith('excluded.')
                ? value[update.slice('excluded.'.length)]
                : update;
          }
          result.push(existing);
        } else {
          const row = { ...value };
          rows.push(row);
          result.push(row);
        }
      }
      return result;
    }
  }
};

const builder = (query: FakeQuery) => {
  const chain = {
    selectAll: () => chain,
    select: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    returningAll: () => chain,
    where: (column: string, op: string, value: unknown) => {
      query.wheres.push({ column, op, value });
      return chain;
    },
    set: (set: Row) => {
      query.set = set;
      return chain;
    },
    values: (values: Row | Row[]) => {
      query.values = Array.isArray(values) ? values : [values];
      return chain;
    },
    onConflict: (
      callback: (oc: {
        columns: (columns: string[]) => {
          doUpdateSet: (
            fn: (eb: { ref: (name: string) => string }) => Row
          ) => unknown;
        };
      }) => unknown
    ) => {
      callback({
        columns: (columns) => ({
          doUpdateSet: (fn) => {
            query.conflictColumns = columns;
            query.conflictSet = fn({ ref: (name) => name });
            return chain;
          },
        }),
      });
      return chain;
    },
    execute: async () => run(query).map((row) => ({ ...row })),
    executeTakeFirst: async () => {
      const row = run(query)[0];
      return row ? { ...row } : undefined;
    },
    executeTakeFirstOrThrow: async () => {
      const row = run(query)[0];
      if (!row) {
        throw new Error('no result');
      }
      return { ...row };
    },
  };
  return chain;
};

const start = (kind: FakeQuery['kind']) => (table: string) =>
  builder({ kind, table, wheres: [] });

export const fakeDatabase = {
  selectFrom: start('select'),
  updateTable: start('update'),
  insertInto: start('insert'),
  deleteFrom: start('delete'),
  transaction: () => ({
    execute: async <T>(callback: (trx: unknown) => Promise<T>) =>
      callback(fakeDatabase),
  }),
};

// In-memory redis with the few commands used by the wiki code.
export const redisStore = new Map<string, string>();
export const fakeRedis = {
  get: async (key: string) => redisStore.get(key) ?? null,
  set: async (key: string, value: string) => {
    redisStore.set(key, value);
    return 'OK';
  },
  incr: async (key: string) => {
    const value = Number(redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, String(value));
    return value;
  },
  expire: async () => 1,
};

// Fixtures ------------------------------------------------------------------

export const WORKSPACE_ID = 'ws01';
export const WIKI_ID = 'wiki'.padEnd(28, '0');
export const ADMIN_ID = 'user-admin';
export const EDITOR_ID = 'user-editor';

const date = new Date('2026-01-02T10:00:00Z');

export const node = (
  id: string,
  type: string,
  parentId: string | null,
  attributes: Record<string, unknown>,
  extra: Partial<SelectNode> = {}
): SelectNode =>
  ({
    id,
    type,
    parent_id: parentId,
    root_id: WIKI_ID,
    workspace_id: WORKSPACE_ID,
    revision: '1',
    attributes: { type, ...attributes },
    created_at: date,
    created_by: ADMIN_ID,
    updated_at: null,
    updated_by: null,
    ...extra,
  }) as SelectNode;

export const block = (
  id: string,
  type: string,
  parentId: string,
  index: string,
  extra: Record<string, unknown> = {}
) => ({ id, type, parentId, index, ...extra });

export const text = (value: string) => ({ type: 'text', text: value });

// A wiki with a category, pages, a database with records and files.
export const buildWikiNodes = (): SelectNode[] => [
  node(WIKI_ID, 'wiki', null, {
    name: 'Docs',
    description: 'Documentation',
    collaborators: { [ADMIN_ID]: 'admin', [EDITOR_ID]: 'editor' },
  }),
  node('cat', 'category', WIKI_ID, {
    name: 'Guides',
    index: 'a0',
    children: { db: { index: 'a1' } },
  }),
  node('page-install', 'page', 'cat', { name: 'Installation', index: 'a0' }),
  node('page-sub', 'page', 'page-install', { name: 'Details', index: 'a0' }),
  node('db', 'database', 'cat', {
    name: 'Tasks',
    index: 'a1',
    nameField: { name: 'Title' },
    fields: {
      f_bool: { id: 'f_bool', type: 'boolean', name: 'Done', index: 'a0' },
      f_select: {
        id: 'f_select',
        type: 'select',
        name: 'Status',
        index: 'a1',
        options: {
          o1: { id: 'o1', name: 'Open' },
          o2: { id: 'o2', name: 'Closed' },
        },
      },
      f_multi: {
        id: 'f_multi',
        type: 'multi_select',
        name: 'Tags',
        index: 'a2',
        options: { t1: { id: 't1', name: 'A' }, t2: { id: 't2', name: 'B' } },
      },
      f_collab: {
        id: 'f_collab',
        type: 'collaborator',
        name: 'Owner',
        index: 'a3',
      },
      f_date: { id: 'f_date', type: 'date', name: 'Due', index: 'a4' },
      f_url: { id: 'f_url', type: 'url', name: 'Link', index: 'a5' },
      f_file: { id: 'f_file', type: 'file', name: 'Files', index: 'a6' },
      f_rel: { id: 'f_rel', type: 'relation', name: 'Related', index: 'a7' },
      f_text: { id: 'f_text', type: 'text', name: 'Notes', index: 'a8' },
      f_num: { id: 'f_num', type: 'number', name: 'Points', index: 'a8' },
    },
  }),
  node('rec-1', 'record', 'db', {
    name: 'First task',
    databaseId: 'db',
    index: 'a0',
    fields: {
      f_bool: { type: 'boolean', value: true },
      f_select: { type: 'string', value: 'o1' },
      f_multi: { type: 'string_array', value: ['t1', 't2', 'missing'] },
      f_collab: { type: 'string_array', value: [ADMIN_ID, 'unknown'] },
      f_date: { type: 'string', value: '2026-03-04T00:00:00.000Z' },
      f_url: { type: 'string', value: 'https://example.com/?a=1&b=2' },
      f_file: { type: 'string_array', value: ['file-img', 'file-pending'] },
      f_rel: { type: 'string_array', value: ['page-install', 'nowhere'] },
      f_text: { type: 'text', value: 'Some <notes>' },
      f_num: { type: 'number', value: 42 },
    },
  }),
  node('rec-2', 'record', 'db', {
    name: 'Second task',
    databaseId: 'db',
    index: 'a1',
    fields: {
      f_bool: { type: 'boolean', value: false },
      f_select: { type: 'string', value: 'unknown' },
      f_multi: { type: 'string', value: 'not-an-array' },
      f_collab: { type: 'string', value: EDITOR_ID },
      f_date: { type: 'string', value: 'not a date' },
      f_url: { type: 'string', value: 'javascript:alert(1)' },
      f_file: { type: 'string', value: 'not-an-array' },
      f_rel: { type: 'string', value: 'not-an-array' },
      f_text: { type: 'string_array', value: ['x', 'y'] },
    },
  }),
  node('file-img', 'file', 'cat', {
    name: 'diagram.png',
    mimeType: 'image/png',
    size: 2048,
    status: FileStatus.Ready,
  }),
  node('file-pdf', 'file', 'cat', {
    name: 'guide é.pdf',
    mimeType: 'application/pdf',
    size: 10,
    status: FileStatus.Ready,
  }),
  node('file-pending', 'file', 'cat', {
    name: 'pending.png',
    mimeType: 'image/png',
    size: 1,
    status: FileStatus.Pending,
  }),
  node('folder-empty', 'folder', WIKI_ID, { name: 'Empty', index: 'a2' }),
  node('page-blank', 'page', WIKI_ID, { name: '', index: 'a3' }),
];

export const buildPublication = (extra: Record<string, unknown> = {}) => ({
  wiki_id: WIKI_ID,
  workspace_id: WORKSPACE_ID,
  slug: 'docs',
  access: 'public',
  home_node_id: null,
  link_token_hash: null,
  link_token_salt: null,
  created_at: date,
  created_by: ADMIN_ID,
  updated_at: null,
  updated_by: null,
  ...extra,
});

export const installDocument = (
  id: string,
  blocks: Record<string, unknown>,
  updatedAt: Date | null = null
) => ({
  id,
  type: 'rich_text',
  workspace_id: WORKSPACE_ID,
  content: { type: 'rich_text', blocks },
  created_at: date,
  updated_at: updatedAt,
});

export const buildDocuments = () => [
  installDocument(
    'page-install',
    {
      h1: block('h1', 'heading1', 'page-install', 'a0', {
        content: [text('Getting started')],
      }),
      p1: block('p1', 'paragraph', 'page-install', 'a1', {
        content: [
          text('Install the server with npm. Ask '),
          { type: 'mention', attrs: { target: ADMIN_ID } },
          { type: 'mention', attrs: {} },
        ],
      }),
      db: block('db', 'database', 'page-install', 'a2'),
      'file-img': block('file-img', 'file', 'page-install', 'a3'),
      'file-pdf': block('file-pdf', 'file', 'page-install', 'a4'),
      'file-pending': block('file-pending', 'file', 'page-install', 'a5'),
      'page-sub': block('page-sub', 'page', 'page-install', 'a6'),
      ghost: block('ghost', 'page', 'page-install', 'a7'),
    },
    new Date('2026-02-01T00:00:00Z')
  ),
  installDocument('rec-1', {
    p: block('p', 'paragraph', 'rec-1', 'a0', {
      content: [text('Record body')],
    }),
  }),
  installDocument('page-sub', {
    p: block('p', 'paragraph', 'page-sub', 'a0', {
      content: [text('Nested details about installation steps')],
    }),
  }),
  {
    id: 'page-blank',
    type: 'other',
    content: { type: 'other' },
    created_at: date,
    updated_at: null,
  },
];

export const buildUsers = () => [
  {
    id: ADMIN_ID,
    workspace_id: WORKSPACE_ID,
    name: 'Ada',
    custom_name: 'Ada <Admin>',
  },
  { id: EDITOR_ID, workspace_id: WORKSPACE_ID, name: 'Bob', custom_name: null },
];
