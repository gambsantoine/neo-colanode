import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectWikiPublication } from '@colanode/server/data/schema';

const mocks = vi.hoisted(() => ({
  version: vi.fn(),
  load: vi.fn(),
  sync: vi.fn(),
  render: vi.fn(),
  texts: vi.fn(),
}));

vi.mock('@colanode/server/lib/wikis/version', () => ({
  fetchWikiVersion: mocks.version,
}));

vi.mock('@colanode/server/lib/wikis/service', () => ({
  loadPublishedWiki: mocks.load,
  syncWikiRoutes: mocks.sync,
  renderWikiNodeContent: mocks.render,
  loadWikiTexts: mocks.texts,
}));

const {
  forgetReadableWiki,
  getReadableWiki,
  getWikiNodeContent,
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
    forgetReadableWiki('wiki1');
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

    mocks.version.mockResolvedValue('v2');
    const third = await getReadableWiki(publication, '/wiki/docs');
    expect(third).not.toBe(first);
    expect(third?.version).toBe('v2');
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('answers null when the workspace or the wiki is gone', async () => {
    mocks.version.mockResolvedValue(null);
    expect(await getReadableWiki(publication, '/wiki/docs')).toBeNull();

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
});
