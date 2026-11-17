import { escapeHtml } from '@colanode/server/lib/wikis/html';
import { WikiHeading } from '@colanode/server/lib/wikis/render-blocks';
import {
  findWikiHome,
  PublishedWiki,
  wikiHref,
} from '@colanode/server/lib/wikis/service';
import { wikiPageTemplate } from '@colanode/server/templates';

const NAV_TYPES = new Set(['page', 'category', 'folder', 'database']);
const MAX_NAV_DEPTH = 4;

// Nodes shown in the side navigation, in reading order. Categories are
// section titles; records are left out (they are listed by their database).
export const flattenWikiNav = (wiki: PublishedWiki): string[] => {
  const order: string[] = [];
  const visit = (parentId: string, depth: number) => {
    if (depth > MAX_NAV_DEPTH) {
      return;
    }

    for (const child of wiki.tree.children.get(parentId) ?? []) {
      if (!NAV_TYPES.has(child.type)) {
        continue;
      }

      if (child.type !== 'category') {
        order.push(child.id);
      }

      visit(child.id, depth + 1);
    }
  };

  visit(wiki.wiki.id, 0);
  return order;
};

const ancestorsOf = (wiki: PublishedWiki, nodeId: string): Set<string> => {
  const ids = new Set<string>();
  let current = wiki.nodes.get(nodeId);
  let guard = 0;
  while (current && guard < 40) {
    ids.add(current.id);
    current = current.parent_id ? wiki.nodes.get(current.parent_id) : undefined;
    guard++;
  }

  return ids;
};

const renderNav = (wiki: PublishedWiki, currentId: string): string => {
  const open = ancestorsOf(wiki, currentId);

  const renderList = (parentId: string, depth: number): string => {
    if (depth > MAX_NAV_DEPTH) {
      return '';
    }

    const items = (wiki.tree.children.get(parentId) ?? [])
      .filter((child) => NAV_TYPES.has(child.type))
      .map((child) => {
        const href = wikiHref(wiki, child.id);
        if (!href) {
          return '';
        }

        const name = escapeHtml(child.name || 'Sans titre');
        const current = child.id === currentId ? ' aria-current="page"' : '';

        if (child.type === 'category') {
          return `<li><div class="section"><a href="${escapeHtml(href)}"${current}>${name}</a></div>${renderList(child.id, depth + 1)}</li>`;
        }

        // Nested pages are only expanded along the current branch.
        const nested =
          open.has(child.id) && child.type !== 'database'
            ? renderList(child.id, depth + 1)
            : '';
        return `<li><a href="${escapeHtml(href)}"${current}>${name}</a>${nested}</li>`;
      })
      .join('');

    return items ? `<ul>${items}</ul>` : '';
  };

  const homeCurrent = currentId === wiki.wiki.id ? ' aria-current="page"' : '';
  return `<ul><li><a href="${escapeHtml(wiki.basePath)}"${homeCurrent}>Accueil</a></li></ul>${renderList(wiki.wiki.id, 0)}`;
};

const renderBreadcrumb = (wiki: PublishedWiki, nodeId: string): string => {
  if (nodeId === wiki.wiki.id) {
    return '';
  }

  const chain: string[] = [];
  let current = wiki.nodes.get(nodeId);
  let guard = 0;
  while (current && current.id !== wiki.wiki.id && guard < 40) {
    current = current.parent_id ? wiki.nodes.get(current.parent_id) : undefined;
    if (current && current.id !== wiki.wiki.id) {
      chain.unshift(current.id);
    }
    guard++;
  }

  const links = [
    `<a href="${escapeHtml(wiki.basePath)}">Accueil</a>`,
    ...chain.map((id) => {
      const href = wikiHref(wiki, id);
      const node = wiki.tree.byId.get(id);
      return href && node
        ? `<a href="${escapeHtml(href)}">${escapeHtml(node.name || 'Sans titre')}</a>`
        : '';
    }),
  ].filter(Boolean);

  return links.join('<span aria-hidden="true">/</span>');
};

const renderToc = (headings: WikiHeading[]): string => {
  const items = headings
    .filter((heading) => heading.level <= 4)
    .map(
      (heading) =>
        `<li class="l${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`
    )
    .join('');

  return headings.length >= 2 ? `<ul>${items}</ul>` : '';
};

const renderPager = (wiki: PublishedWiki, nodeId: string): string => {
  const order = flattenWikiNav(wiki);
  const isRoot = nodeId === wiki.wiki.id;
  // The root shows the home page: the pager continues after it.
  const homeId = isRoot ? findWikiHome(wiki) : null;
  const index = order.indexOf(homeId ?? nodeId);
  if (index === -1 && !isRoot) {
    return '';
  }

  const previousId = !isRoot && index > 0 ? order[index - 1] : null;
  const nextId = index === -1 ? order[0] : order[index + 1];

  const link = (
    id: string | null | undefined,
    label: string,
    className: string
  ) => {
    if (!id) {
      return '';
    }

    const href = wikiHref(wiki, id);
    const node = wiki.tree.byId.get(id);
    return href && node
      ? `<a class="${className}" href="${escapeHtml(href)}"><small>${label}</small>${escapeHtml(node.name || 'Sans titre')}</a>`
      : '';
  };

  const html =
    link(previousId, 'Précédent', 'prev') + link(nextId, 'Suivant', 'next');
  return html ? `<nav class="pager" aria-label="Pages">${html}</nav>` : '';
};

export interface WikiPageView {
  wiki: PublishedWiki;
  nodeId: string;
  title: string;
  contentHtml: string;
  headings: WikiHeading[];
  updatedAt: Date | null;
  description: string | null;
  nonce: string;
  canonicalUrl: string | null;
  indexable: boolean;
  searchQuery?: string;
  withPager?: boolean;
}

export const renderWikiPage = (view: WikiPageView): string => {
  const { wiki } = view;
  const wikiName =
    (wiki.wiki.attributes as { name?: string }).name?.trim() || 'Wiki';
  const hasPlantUml = view.contentHtml.includes('data-plantuml');

  return wikiPageTemplate({
    pageTitle:
      view.title === wikiName ? wikiName : `${view.title} · ${wikiName}`,
    wikiName,
    title: view.title,
    description: view.description,
    robots: view.indexable ? 'index, follow' : 'noindex, nofollow',
    canonicalUrl: view.canonicalUrl,
    homeHref: wiki.basePath,
    searchHref: `${wiki.basePath}/_search`,
    searchQuery: view.searchQuery ?? '',
    navHtml: renderNav(wiki, view.nodeId),
    breadcrumbHtml: renderBreadcrumb(wiki, view.nodeId),
    contentHtml: view.contentHtml,
    tocHtml: renderToc(view.headings),
    pagerHtml: view.withPager === false ? '' : renderPager(wiki, view.nodeId),
    updatedAt: view.updatedAt
      ? view.updatedAt.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null,
    nonce: view.nonce,
    nonceJson: JSON.stringify(view.nonce),
    hasPlantUml,
    plantUmlBaseJson: JSON.stringify(`${wiki.basePath}/_assets/plantuml`),
  });
};

export const buildWikiCsp = (nonce: string): string => {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
};
