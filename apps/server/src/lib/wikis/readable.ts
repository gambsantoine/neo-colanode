import { SelectWikiPublication } from '@colanode/server/data/schema';
import { createLogger } from '@colanode/server/lib/logger';
import { LruCache } from '@colanode/server/lib/wikis/cache';
import {
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

// Returns the published wiki, loaded once per version of its content: a
// request only costs one aggregate query while nothing changed.
export const getReadableWiki = async (
  publication: SelectWikiPublication,
  basePath: string
): Promise<ReadableWiki | null> => {
  const version = await fetchWikiVersion(publication);
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

export const getWikiNodeContent = async (
  entry: ReadableWiki,
  nodeId: string
): Promise<WikiNodeContent> => {
  const cached = entry.contents.get(nodeId);
  if (cached && Date.now() - cached.at < CONTENT_TTL_MS) {
    return cached.content;
  }

  const content = await renderWikiNodeContent(entry.wiki, nodeId);
  entry.contents.set(nodeId, { content, at: Date.now() });
  return content;
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

export const forgetReadableWiki = (wikiId: string) => {
  wikis.delete(wikiId);
};
