import { SelectWikiPublication } from '@colanode/server/data/schema';
import { createLogger } from '@colanode/server/lib/logger';
import { LruCache } from '@colanode/server/lib/wikis/cache';
import {
  fetchWikiPublicationBySlug,
  loadPublishedWiki,
  loadWikiTexts,
  PublishedWiki,
  renderWikiNodeContent,
  syncWikiRoutes,
  WikiNodeContent,
} from '@colanode/server/lib/wikis/service';
import { fetchWikiVersion } from '@colanode/server/lib/wikis/version';

const logger = createLogger('server:wiki:cache');

// Rendered pages also show user names (mentions, collaborator fields), which
// are not part of the wiki version: they are refreshed after this delay.
const CONTENT_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_WIKIS = 50;
const MAX_CACHED_PAGES_PER_WIKI = 300;

export interface ReadableWiki {
  version: string;
  wiki: PublishedWiki;
  contents: LruCache<string, { content: WikiNodeContent; at: number }>;
  texts: Promise<Map<string, string>> | null;
}

const wikis = new LruCache<string, ReadableWiki>(MAX_CACHED_WIKIS);

// A page view is followed by requests for its images: for those requests
// only, the publication and the version of the wiki are reused for this
// short delay instead of being queried for every image. Pages always read
// the current state.
const VERSION_REUSE_MS = 2000;
const versions = new LruCache<string, { version: string | null; at: number }>(
  MAX_CACHED_WIKIS
);

// Publications looked up by address, reused for the same short delay.
const publications = new Map<
  string,
  { publication: SelectWikiPublication; at: number }
>();

export const getPublicationBySlug = async (
  slug: string,
  reuse = false
): Promise<SelectWikiPublication | undefined> => {
  const cached = publications.get(slug);
  if (reuse && cached && Date.now() - cached.at < VERSION_REUSE_MS) {
    return cached.publication;
  }

  const publication = await fetchWikiPublicationBySlug(slug);
  publications.delete(slug);
  // Unknown addresses are not kept: a wiki published a moment later must
  // open right away.
  if (!publication) {
    return undefined;
  }

  publications.set(slug, { publication, at: Date.now() });
  if (publications.size > MAX_CACHED_WIKIS * 4) {
    publications.delete(publications.keys().next().value as string);
  }

  return publication;
};

const fetchVersion = async (
  publication: SelectWikiPublication,
  reuse: boolean
): Promise<string | null> => {
  const key = `${publication.wiki_id}:${publication.updated_at?.getTime() ?? 0}:${publication.slug}`;
  const cached = versions.get(key);
  if (reuse && cached && Date.now() - cached.at < VERSION_REUSE_MS) {
    return cached.version;
  }

  const version = await fetchWikiVersion(publication);
  versions.set(key, { version, at: Date.now() });
  return version;
};

// Returns the published wiki, loaded once per version of its content: a
// request only costs one aggregate query while nothing changed.
export const getReadableWiki = async (
  publication: SelectWikiPublication,
  basePath: string,
  // True for the files of a page (images): see VERSION_REUSE_MS.
  reuse = false
): Promise<ReadableWiki | null> => {
  const version = await fetchVersion(publication, reuse);
  if (!version) {
    wikis.delete(publication.wiki_id);
    return null;
  }

  const cached = wikis.get(publication.wiki_id);
  if (cached && cached.version === version) {
    return cached;
  }

  const wiki = await loadPublishedWiki(publication, basePath);
  if (!wiki) {
    wikis.delete(publication.wiki_id);
    return null;
  }

  try {
    await syncWikiRoutes(wiki);
  } catch (error) {
    logger.error(error, `Failed to sync routes of wiki ${wiki.wiki.id}`);
  }

  const entry: ReadableWiki = {
    version,
    wiki,
    contents: new LruCache(MAX_CACHED_PAGES_PER_WIKI),
    texts: null,
  };
  wikis.set(publication.wiki_id, entry);
  return entry;
};

// The rendered page and when it was rendered: `at` changes when names are
// refreshed, so it is part of the ETag of the page.
export const getWikiNodeRender = async (
  entry: ReadableWiki,
  nodeId: string
): Promise<{ content: WikiNodeContent; at: number }> => {
  const cached = entry.contents.get(nodeId);
  if (cached && Date.now() - cached.at < CONTENT_TTL_MS) {
    return cached;
  }

  const content = await renderWikiNodeContent(entry.wiki, nodeId);
  const render = { content, at: Date.now() };
  entry.contents.set(nodeId, render);
  return render;
};

export const getWikiNodeContent = async (
  entry: ReadableWiki,
  nodeId: string
): Promise<WikiNodeContent> => {
  return (await getWikiNodeRender(entry, nodeId)).content;
};

export const getWikiTexts = (
  entry: ReadableWiki
): Promise<Map<string, string>> => {
  if (!entry.texts) {
    entry.texts = loadWikiTexts(entry.wiki).catch((error) => {
      entry.texts = null;
      throw error;
    });
  }

  return entry.texts;
};

// Empties every cache of this module (tests, or a full reset).
export const clearReadableWikis = () => {
  for (const key of [...publications.keys()]) {
    publications.delete(key);
  }
  wikis.clear();
  versions.clear();
};

export const forgetReadableWiki = (wikiId: string) => {
  wikis.delete(wikiId);
  for (const [slug, cached] of publications) {
    if (cached.publication.wiki_id === wikiId) {
      publications.delete(slug);
    }
  }
};
