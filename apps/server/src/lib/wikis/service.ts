import { sha256 } from 'js-sha256';

import {
  DatabaseAttributes,
  extractDocumentText,
  FieldAttributes,
  FieldValue,
  FileStatus,
  NodeAttributes,
  RichTextContent,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { redis } from '@colanode/server/data/redis';
import {
  SelectNode,
  SelectWikiPublication,
} from '@colanode/server/data/schema';
import { escapeHtml } from '@colanode/server/lib/wikis/html';
import {
  computeWikiTree,
  WikiTree,
  WikiTreeNode,
} from '@colanode/server/lib/wikis/paths';
import {
  BlockRenderContext,
  renderDocumentBlocks,
  WikiHeading,
} from '@colanode/server/lib/wikis/render-blocks';

// Node types read from the database for a public wiki. Anything else
// (channels, messages...) never leaves the server.
const PUBLIC_NODE_TYPES = [
  'wiki',
  'page',
  'category',
  'folder',
  'database',
  'record',
  'file',
] as const;

export interface PublishedWiki {
  publication: SelectWikiPublication;
  wiki: SelectNode;
  nodes: Map<string, SelectNode>;
  tree: WikiTree;
  // `/prefix/wiki/<slug>`, used for every link of the rendered pages.
  basePath: string;
}

const nameOf = (node: SelectNode): string => {
  const attributes = node.attributes as { name?: string | null };
  return attributes.name?.trim() || 'Sans titre';
};

export const fetchWikiPublicationBySlug = async (slug: string) => {
  return database
    .selectFrom('wiki_publications')
    .selectAll()
    .where('slug', '=', slug)
    .executeTakeFirst();
};

export const loadPublishedWiki = async (
  publication: SelectWikiPublication,
  basePath: string
): Promise<PublishedWiki | null> => {
  const rows = await database
    .selectFrom('nodes')
    .selectAll()
    .where('root_id', '=', publication.wiki_id)
    .where('workspace_id', '=', publication.workspace_id)
    .where('type', 'in', [...PUBLIC_NODE_TYPES])
    .execute();

  const nodes = new Map(rows.map((row) => [row.id, row]));
  const wiki = nodes.get(publication.wiki_id);
  if (!wiki || wiki.type !== 'wiki') {
    return null;
  }

  const treeNodes: WikiTreeNode[] = rows.map((row) => {
    const attributes = row.attributes as {
      name?: string;
      slug?: string | null;
      index?: string;
    };
    const parent = row.parent_id ? nodes.get(row.parent_id) : undefined;
    const parentChildren = (
      parent?.attributes as {
        children?: Record<string, { index?: string | null }>;
      }
    )?.children;

    return {
      id: row.id,
      type: row.type,
      parentId: row.parent_id,
      name: attributes.name ?? '',
      slug: attributes.slug ?? null,
      index: parentChildren?.[row.id]?.index ?? attributes.index ?? null,
    };
  });

  return {
    publication,
    wiki,
    nodes,
    tree: computeWikiTree(wiki.id, treeNodes),
    basePath,
  };
};

// Stores the current paths of the wiki and keeps the old ones so that links
// shared before a rename still redirect. Skipped when nothing changed.
export const syncWikiRoutes = async (wiki: PublishedWiki): Promise<void> => {
  const entries = [...wiki.tree.paths.entries()].sort(([a], [b]) =>
    a < b ? -1 : 1
  );
  const fingerprint = sha256(JSON.stringify(entries));
  const cacheKey = `wiki:routes:${wiki.wiki.id}`;

  try {
    if ((await redis.get(cacheKey)) === fingerprint) {
      return;
    }
  } catch {
    // Redis is only an optimisation here.
  }

  const now = new Date();
  await database.transaction().execute(async (trx) => {
    await trx
      .updateTable('wiki_routes')
      .set({ is_current: false })
      .where('wiki_id', '=', wiki.wiki.id)
      .execute();

    if (entries.length === 0) {
      return;
    }

    await trx
      .insertInto('wiki_routes')
      .values(
        entries.map(([nodeId, path]) => ({
          wiki_id: wiki.wiki.id,
          path,
          node_id: nodeId,
          is_current: true,
          created_at: now,
        }))
      )
      .onConflict((oc) =>
        oc.columns(['wiki_id', 'path']).doUpdateSet((eb) => ({
          node_id: eb.ref('excluded.node_id'),
          is_current: true,
        }))
      )
      .execute();
  });

  try {
    await redis.set(cacheKey, fingerprint, { EX: 3600 });
  } catch {
    // ignore
  }
};

export type WikiPathResolution =
  | { type: 'found'; nodeId: string }
  | { type: 'redirect'; path: string }
  | { type: 'not_found' };

export const resolveWikiPath = async (
  wiki: PublishedWiki,
  path: string
): Promise<WikiPathResolution> => {
  const nodeId = wiki.tree.nodes.get(path);
  if (nodeId) {
    return { type: 'found', nodeId };
  }

  const route = await database
    .selectFrom('wiki_routes')
    .select(['node_id'])
    .where('wiki_id', '=', wiki.wiki.id)
    .where('path', '=', path)
    .executeTakeFirst();

  const current = route ? wiki.tree.paths.get(route.node_id) : undefined;
  if (current !== undefined) {
    return { type: 'redirect', path: current };
  }

  return { type: 'not_found' };
};

export const wikiHref = (
  wiki: PublishedWiki,
  nodeId: string
): string | null => {
  const path = wiki.tree.paths.get(nodeId);
  if (path === undefined) {
    return null;
  }

  return path ? `${wiki.basePath}/${path}` : wiki.basePath;
};

export const wikiFileHref = (wiki: PublishedWiki, file: SelectNode): string => {
  const attributes = file.attributes as { name?: string };
  return `${wiki.basePath}/_files/${file.id}/${encodeURIComponent(attributes.name ?? 'fichier')}`;
};

export const isPublicFile = (wiki: PublishedWiki, fileId: string) => {
  const file = wiki.nodes.get(fileId);
  if (!file || file.type !== 'file') {
    return null;
  }

  const attributes = file.attributes as { status?: number };
  return attributes.status === FileStatus.Ready ? file : null;
};

const fetchUserNames = async (
  workspaceId: string,
  userIds: string[]
): Promise<Map<string, string>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await database
    .selectFrom('users')
    .select(['id', 'name', 'custom_name'])
    .where('workspace_id', '=', workspaceId)
    .where('id', 'in', userIds)
    .execute();

  return new Map(users.map((user) => [user.id, user.custom_name || user.name]));
};

const collectMentionTargets = (content: RichTextContent | null): string[] => {
  const targets = new Set<string>();
  for (const block of Object.values(content?.blocks ?? {})) {
    for (const leaf of block.content ?? []) {
      if (leaf.type === 'mention' && typeof leaf.attrs?.target === 'string') {
        targets.add(leaf.attrs.target);
      }
    }
  }

  return [...targets];
};

const fetchDocument = async (
  nodeId: string
): Promise<{ content: RichTextContent; updatedAt: Date | null } | null> => {
  const document = await database
    .selectFrom('documents')
    .select(['content', 'updated_at', 'created_at'])
    .where('id', '=', nodeId)
    .executeTakeFirst();

  if (!document || document.content.type !== 'rich_text') {
    return null;
  }

  return {
    content: document.content as RichTextContent,
    updatedAt: document.updated_at ?? document.created_at,
  };
};

const sortedFields = (attributes: DatabaseAttributes): FieldAttributes[] => {
  return Object.values(attributes.fields ?? {}).sort((a, b) =>
    a.index < b.index ? -1 : a.index > b.index ? 1 : 0
  );
};

const formatFieldValue = (
  wiki: PublishedWiki,
  field: FieldAttributes,
  value: FieldValue | undefined,
  users: Map<string, string>
): string => {
  if (!value) {
    return '';
  }

  switch (field.type) {
    case 'boolean':
      return value.value === true ? '✓' : '';
    case 'select': {
      const option =
        typeof value.value === 'string' ? field.options?.[value.value] : null;
      return option
        ? `<span class="tag">${escapeHtml(option.name)}</span>`
        : '';
    }
    case 'multi_select': {
      const ids = Array.isArray(value.value) ? value.value : [];
      return ids
        .map((id) => field.options?.[id])
        .filter((option) => option !== undefined)
        .map((option) => `<span class="tag">${escapeHtml(option!.name)}</span>`)
        .join(' ');
    }
    case 'collaborator': {
      const ids = Array.isArray(value.value) ? value.value : [value.value];
      return ids
        .map((id) => users.get(String(id)))
        .filter(Boolean)
        .map((name) => escapeHtml(name))
        .join(', ');
    }
    case 'date': {
      const date = new Date(String(value.value));
      return Number.isNaN(date.getTime())
        ? ''
        : escapeHtml(date.toLocaleDateString('fr-FR'));
    }
    case 'url':
      return typeof value.value === 'string' && /^https?:\/\//.test(value.value)
        ? `<a href="${escapeHtml(value.value)}" rel="noopener noreferrer nofollow">${escapeHtml(value.value)}</a>`
        : escapeHtml(value.value);
    case 'file': {
      const ids = Array.isArray(value.value) ? value.value : [];
      return ids
        .map((id) => isPublicFile(wiki, String(id)))
        .filter((file) => file !== null)
        .map(
          (file) =>
            `<a href="${escapeHtml(wikiFileHref(wiki, file!))}" download>${escapeHtml(nameOf(file!))}</a>`
        )
        .join(', ');
    }
    case 'relation': {
      const ids = Array.isArray(value.value) ? value.value : [];
      return ids
        .map((id) => {
          const href = wikiHref(wiki, String(id));
          const node = wiki.nodes.get(String(id));
          return href && node
            ? `<a href="${escapeHtml(href)}">${escapeHtml(nameOf(node))}</a>`
            : null;
        })
        .filter(Boolean)
        .join(', ');
    }
    default:
      return Array.isArray(value.value)
        ? escapeHtml(value.value.join(', '))
        : escapeHtml(value.value);
  }
};

const recordsOf = (wiki: PublishedWiki, databaseId: string): SelectNode[] => {
  return (wiki.tree.children.get(databaseId) ?? [])
    .map((child) => wiki.nodes.get(child.id))
    .filter(
      (node): node is SelectNode => node !== undefined && node.type === 'record'
    );
};

const collectDatabaseUserIds = (wiki: PublishedWiki, databaseId: string) => {
  const db = wiki.nodes.get(databaseId);
  if (!db || db.type !== 'database') {
    return [];
  }

  const fields = sortedFields(db.attributes as DatabaseAttributes).filter(
    (field) => field.type === 'collaborator'
  );
  const ids = new Set<string>();
  for (const record of recordsOf(wiki, databaseId)) {
    const values = (
      record.attributes as { fields?: Record<string, FieldValue> }
    ).fields;
    for (const field of fields) {
      const value = values?.[field.id]?.value;
      for (const id of Array.isArray(value) ? value : [value]) {
        if (typeof id === 'string') {
          ids.add(id);
        }
      }
    }
  }

  return [...ids];
};

const renderDatabaseTable = (
  wiki: PublishedWiki,
  databaseId: string,
  users: Map<string, string>
): string | null => {
  const db = wiki.nodes.get(databaseId);
  if (!db || db.type !== 'database') {
    return null;
  }

  const attributes = db.attributes as DatabaseAttributes;
  const fields = sortedFields(attributes);
  const records = recordsOf(wiki, databaseId);
  const nameLabel = attributes.nameField?.name || 'Nom';
  const href = wikiHref(wiki, databaseId);

  const header = [nameLabel, ...fields.map((field) => field.name)]
    .map((name) => `<th>${escapeHtml(name)}</th>`)
    .join('');

  const rows = records
    .map((record) => {
      const recordHref = wikiHref(wiki, record.id);
      const values = (
        record.attributes as { fields?: Record<string, FieldValue> }
      ).fields;
      const cells = fields
        .map(
          (field) =>
            `<td>${formatFieldValue(wiki, field, values?.[field.id], users)}</td>`
        )
        .join('');
      const name = escapeHtml(nameOf(record));
      return `<tr><td>${recordHref ? `<a href="${escapeHtml(recordHref)}">${name}</a>` : name}</td>${cells}</tr>`;
    })
    .join('');

  const empty =
    records.length === 0
      ? `<tr><td colspan="${fields.length + 1}" class="muted">Aucun enregistrement</td></tr>`
      : '';

  const title = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(attributes.name)}</a>`
    : escapeHtml(attributes.name);

  return `<figure class="database"><figcaption>${title}</figcaption><div class="table"><table><thead><tr>${header}</tr></thead><tbody>${rows}${empty}</tbody></table></div></figure>`;
};

const buildBlockContext = (
  wiki: PublishedWiki,
  users: Map<string, string>
): BlockRenderContext => ({
  nodeLink: (nodeId) => {
    const node = wiki.nodes.get(nodeId);
    const href = wikiHref(wiki, nodeId);
    return node && href ? { href, name: nameOf(node), type: node.type } : null;
  },
  file: (fileId) => {
    const file = isPublicFile(wiki, fileId);
    if (!file) {
      return null;
    }

    const attributes = file.attributes as { mimeType: string; size: number };
    return {
      href: wikiFileHref(wiki, file),
      name: nameOf(file),
      mimeType: attributes.mimeType,
      size: attributes.size,
    };
  },
  userName: (userId) => users.get(userId) ?? null,
  database: (databaseId) => renderDatabaseTable(wiki, databaseId, users),
});

export interface WikiNodeContent {
  title: string;
  html: string;
  headings: WikiHeading[];
  updatedAt: Date | null;
  description: string | null;
}

const renderChildList = (wiki: PublishedWiki, parentId: string): string => {
  const items = (wiki.tree.children.get(parentId) ?? [])
    .map((child) => {
      const href = wikiHref(wiki, child.id);
      return href
        ? `<li><a href="${escapeHtml(href)}">${escapeHtml(child.name || 'Sans titre')}</a></li>`
        : '';
    })
    .join('');

  const files = [...wiki.nodes.values()]
    .filter((node) => node.parent_id === parentId && node.type === 'file')
    .map((file) => isPublicFile(wiki, file.id))
    .filter((file): file is SelectNode => file !== null)
    .map(
      (file) =>
        `<li><a href="${escapeHtml(wikiFileHref(wiki, file))}" download>${escapeHtml(nameOf(file))}</a></li>`
    )
    .join('');

  if (!items && !files) {
    return '<p class="muted">Cette section est vide.</p>';
  }

  return `${items ? `<ul class="children">${items}</ul>` : ''}${files ? `<h2>Fichiers</h2><ul class="children files">${files}</ul>` : ''}`;
};

// First page directly under the wiki, used as home when none is chosen.
export const findWikiHome = (wiki: PublishedWiki): string | null => {
  const chosen = wiki.publication.home_node_id;
  if (chosen && wiki.nodes.get(chosen)?.type === 'page') {
    return chosen;
  }

  const first = (wiki.tree.children.get(wiki.wiki.id) ?? []).find(
    (child) => child.type === 'page'
  );
  return first?.id ?? null;
};

export const renderWikiNodeContent = async (
  wiki: PublishedWiki,
  nodeId: string
): Promise<WikiNodeContent> => {
  const node = wiki.nodes.get(nodeId)!;
  const attributes = node.attributes as NodeAttributes;

  // The wiki root shows its home page, or the list of sections.
  if (node.type === 'wiki') {
    const homeId = findWikiHome(wiki);
    const description =
      (attributes as { description?: string | null }).description ?? null;
    if (homeId) {
      const home = await renderWikiNodeContent(wiki, homeId);
      return { ...home, title: nameOf(node), description };
    }

    return {
      title: nameOf(node),
      html: renderChildList(wiki, node.id),
      headings: [],
      updatedAt: node.updated_at ?? node.created_at,
      description,
    };
  }

  const userIds = new Set<string>();
  const document =
    node.type === 'page' || node.type === 'record'
      ? await fetchDocument(node.id)
      : null;

  for (const id of collectMentionTargets(document?.content ?? null)) {
    userIds.add(id);
  }

  const databaseIds = new Set<string>();
  if (node.type === 'database') {
    databaseIds.add(node.id);
  }
  for (const block of Object.values(document?.content.blocks ?? {})) {
    if (block.type === 'database') {
      databaseIds.add(block.id);
    }
  }
  for (const databaseId of databaseIds) {
    for (const id of collectDatabaseUserIds(wiki, databaseId)) {
      userIds.add(id);
    }
  }

  const users = await fetchUserNames(wiki.wiki.workspace_id, [...userIds]);
  const context = buildBlockContext(wiki, users);
  const updatedAt = document?.updatedAt ?? node.updated_at ?? node.created_at;

  let html = '';
  let headings: WikiHeading[] = [];

  if (node.type === 'record') {
    const db = wiki.nodes.get(
      (attributes as { databaseId: string }).databaseId
    );
    if (db && db.type === 'database') {
      const values = (attributes as { fields?: Record<string, FieldValue> })
        .fields;
      const rows = sortedFields(db.attributes as DatabaseAttributes)
        .map((field) => {
          const value = formatFieldValue(
            wiki,
            field,
            values?.[field.id],
            users
          );
          return value
            ? `<div><dt>${escapeHtml(field.name)}</dt><dd>${value}</dd></div>`
            : '';
        })
        .join('');
      if (rows) {
        html += `<dl class="fields">${rows}</dl>`;
      }
    }
  }

  if (document) {
    const rendered = renderDocumentBlocks(
      node.id,
      document.content.blocks,
      context
    );
    html += rendered.html;
    headings = rendered.headings;
  }

  if (node.type === 'database') {
    html += renderDatabaseTable(wiki, node.id, users) ?? '';
  }

  if (node.type === 'category' || node.type === 'folder') {
    html += renderChildList(wiki, node.id);
  }

  if (node.type === 'page') {
    const subpages = (wiki.tree.children.get(node.id) ?? []).length;
    if (subpages > 0) {
      html += `<h2>Dans cette section</h2>${renderChildList(wiki, node.id)}`;
    }
  }

  if (!html) {
    html = '<p class="muted">Cette page est vide.</p>';
  }

  return { title: nameOf(node), html, headings, updatedAt, description: null };
};

export interface WikiSearchResult {
  href: string;
  title: string;
  excerpt: string;
}

export const searchWiki = async (
  wiki: PublishedWiki,
  query: string
): Promise<WikiSearchResult[]> => {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .slice(0, 8);
  if (terms.length === 0) {
    return [];
  }

  const ids = [...wiki.tree.paths.keys()].filter((id) => id !== wiki.wiki.id);
  const documents =
    ids.length > 0
      ? await database
          .selectFrom('documents')
          .select(['id', 'content'])
          .where('id', 'in', ids)
          .execute()
      : [];
  const texts = new Map(
    documents.map((document) => [
      document.id,
      extractDocumentText(document.id, document.content) ?? '',
    ])
  );

  const results: (WikiSearchResult & { score: number })[] = [];
  for (const id of ids) {
    const node = wiki.nodes.get(id);
    const href = wikiHref(wiki, id);
    if (!node || !href) {
      continue;
    }

    const title = nameOf(node);
    const text = texts.get(id) ?? '';
    const haystackTitle = title.toLowerCase();
    const haystackText = text.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (haystackTitle.includes(term)) {
        score += 5;
      }
      if (haystackText.includes(term)) {
        score += 1;
      }
    }

    if (score === 0) {
      continue;
    }

    const position = Math.max(0, haystackText.indexOf(terms[0]!));
    const start = Math.max(0, position - 60);
    const excerpt =
      (start > 0 ? '…' : '') +
      text
        .slice(start, start + 180)
        .replace(/\s+/g, ' ')
        .trim() +
      (text.length > start + 180 ? '…' : '');

    results.push({ href, title, excerpt, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ href, title, excerpt }) => ({ href, title, excerpt }));
};
