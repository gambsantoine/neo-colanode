import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectWikiPublication } from '@colanode/server/data/schema';

const mocks = vi.hoisted(() => ({
  version: vi.fn(),
  load: vi.fn(),
  sync: vi.fn(),
  render: vi.fn(),
  texts: vi.fn(),
  publicationBySlug: vi.fn(),
}));

vi.mock('@colanode/server/lib/wikis/version', () => ({
  fetchWikiVersion: mocks.version,
}));

vi.mock('@colanode/server/lib/wikis/service', () => ({
  loadPublishedWiki: mocks.load,
  syncWikiRoutes: mocks.sync,
  renderWikiNodeContent: mocks.render,
  loadWikiTexts: mocks.texts,
  fetchWikiPublicationBySlug: mocks.publicationBySlug,
}));

const {
  clearReadableWikis,
  forgetReadableWiki,
  getPublicationBySlug,
  getReadableWiki,
  getWikiNodeContent,
  getWikiNodeRender,
  getWikiTexts,
} = await import('@colanode/server/lib/wikis/readable');

const publication = {
  wiki_id: 'wiki1',
  workspace_id: 'ws1',
  slug: 'docs',
} as SelectWikiPublication;

const wiki = { wiki: { id: 'wiki1' } };

describe('readable wiki cache', () => {
  beforeEach(() => {
    clearReadableWikis();
    vi.clearAllMocks();
    mocks.version.mockResolvedValue('v1');
    mocks.load.mockResolvedValue(wiki);
    mocks.sync.mockResolvedValue(undefined);
  });

  it('loads a wiki once per version', async () => {
    const first = await getReadableWiki(publication, '/wiki/docs');
    const second = await getReadableWiki(publication, '/wiki/docs');

    expect(first).toBe(second);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.sync).toHaveBeenCalledTimes(1);

    // Files of a page reuse the version for 2 seconds; pages never do.
    mocks.version.mockResolvedValue('v2');
    expect(await getReadableWiki(publication, '/wiki/docs', true)).toBe(first);

    const third = await getReadableWiki(publication, '/wiki/docs');
    expect(third).not.toBe(first);
    expect(third?.version).toBe('v2');
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('answers null when the workspace or the wiki is gone', async () => {
    mocks.version.mockResolvedValue(null);
    expect(await getReadableWiki(publication, '/wiki/docs')).toBeNull();

    clearReadableWikis();
    mocks.version.mockResolvedValue('v1');
    mocks.load.mockResolvedValue(null);
    expect(await getReadableWiki(publication, '/wiki/docs')).toBeNull();
  });

  it('still serves the wiki when the routes cannot be saved', async () => {
    mocks.sync.mockRejectedValue(new Error('db down'));
    const entry = await getReadableWiki(publication, '/wiki/docs');
    expect(entry?.wiki).toBe(wiki);
  });

  it('caches rendered pages and refreshes them after the delay', async () => {
    vi.useFakeTimers();
    try {
      const entry = (await getReadableWiki(publication, '/wiki/docs'))!;
      mocks.render.mockResolvedValue({ title: 'A' });

      await getWikiNodeContent(entry, 'page1');
      await getWikiNodeContent(entry, 'page1');
      expect(mocks.render).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await getWikiNodeContent(entry, 'page1');
      expect(mocks.render).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads search texts once, and again after a failure', async () => {
    const entry = (await getReadableWiki(publication, '/wiki/docs'))!;
    mocks.texts.mockRejectedValueOnce(new Error('boom'));
    await expect(getWikiTexts(entry)).rejects.toThrow('boom');

    const texts = new Map([['page1', 'hello']]);
    mocks.texts.mockResolvedValue(texts);
    expect(await getWikiTexts(entry)).toBe(texts);
    expect(await getWikiTexts(entry)).toBe(texts);
    expect(mocks.texts).toHaveBeenCalledTimes(2);
  });

  it('reuses a publication looked up by address for a short time', async () => {
    const fetch = mocks.publicationBySlug;
    fetch.mockResolvedValue(publication);

    expect(await getPublicationBySlug('docs')).toBe(publication);
    expect(await getPublicationBySlug('docs', true)).toBe(publication);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Pages always read it again.
    await getPublicationBySlug('docs');
    expect(fetch).toHaveBeenCalledTimes(2);

    forgetReadableWiki('wiki1');
    await getPublicationBySlug('docs', true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('never keeps an unknown address', async () => {
    const fetch = mocks.publicationBySlug;
    fetch.mockResolvedValueOnce(undefined).mockResolvedValueOnce(publication);

    expect(await getPublicationBySlug('docs', true)).toBeUndefined();
    expect(await getPublicationBySlug('docs', true)).toBe(publication);
  });

  it('dates each render so that refreshed names change the page tag', async () => {
    const entry = (await getReadableWiki(publication, '/wiki/docs'))!;
    mocks.render.mockResolvedValue({ title: 'A' });

    const first = await getWikiNodeRender(entry, 'page1');
    expect(await getWikiNodeRender(entry, 'page1')).toBe(first);
    expect(first.at).toBeGreaterThan(0);
  });
});
