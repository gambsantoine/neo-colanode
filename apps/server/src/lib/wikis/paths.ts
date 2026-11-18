import { isValidSlug, slugify, uniqueSlug } from '@colanode/core';

// Node types that get their own readable address in a published wiki.
export const WIKI_ROUTABLE_TYPES = new Set([
  'page',
  'category',
  'folder',
  'database',
  'record',
]);

export interface WikiTreeNode {
  id: string;
  type: string;
  parentId: string | null;
  name: string;
  slug?: string | null;
  // Order of the node among its siblings (from the parent `children` map).
  index?: string | null;
}

export interface WikiTree {
  // node id -> readable path, without leading slash ('' for the wiki home).
  paths: Map<string, string>;
  // readable path -> node id
  nodes: Map<string, string>;
  // parent id -> routable children, in display order
  children: Map<string, WikiTreeNode[]>;
  byId: Map<string, WikiTreeNode>;
}

const compareNodes = (a: WikiTreeNode, b: WikiTreeNode) => {
  const left = a.index ?? a.id;
  const right = b.index ?? b.id;
  if (left === right) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  return left < right ? -1 : 1;
};

export const baseSlugForNode = (node: WikiTreeNode): string => {
  if (node.slug && isValidSlug(node.slug)) {
    return node.slug;
  }

  const slug = slugify(node.name ?? '');
  return slug.length > 0 ? slug : node.type;
};

// Computes the readable path of every routable node of a wiki. Siblings with
// the same name get `-2`, `-3`... in display order, so the first one keeps
// the clean address.
export const computeWikiTree = (
  wikiId: string,
  nodes: WikiTreeNode[]
): WikiTree => {
  const byId = new Map<string, WikiTreeNode>();
  const children = new Map<string, WikiTreeNode[]>();

  for (const node of nodes) {
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    if (!WIKI_ROUTABLE_TYPES.has(node.type) || !node.parentId) {
      continue;
    }

    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }

  for (const list of children.values()) {
    list.sort(compareNodes);
  }

  const paths = new Map<string, string>();
  const pathToNode = new Map<string, string>();

  const visit = (parentId: string, parentPath: string, depth: number) => {
    // Guards against cycles in corrupted data.
    if (depth > 32) {
      return;
    }

    const taken = new Set<string>();
    for (const child of children.get(parentId) ?? []) {
      const slug = uniqueSlug(baseSlugForNode(child), taken);
      taken.add(slug);

      const path = parentPath ? `${parentPath}/${slug}` : slug;
      paths.set(child.id, path);
      pathToNode.set(path, child.id);
      visit(child.id, path, depth + 1);
    }
  };

  paths.set(wikiId, '');
  pathToNode.set('', wikiId);
  visit(wikiId, '', 0);

  return { paths, nodes: pathToNode, children, byId };
};

// Normalizes the wildcard part of `/wiki/:slug/*` for lookups.
export const normalizeWikiPath = (value: string | undefined | null): string => {
  if (!value) {
    return '';
  }

  return value
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .filter((segment) => segment.length > 0)
    .join('/')
    .toLowerCase();
};
