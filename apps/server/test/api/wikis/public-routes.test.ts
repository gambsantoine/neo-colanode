import { Readable } from 'stream';

import { fastify, FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wikiPublicRoutes } from '@colanode/server/api/public/wiki-routes';
import { storage } from '@colanode/server/lib/storage';
import { generateWikiLinkToken } from '@colanode/server/lib/wikis/publications';

import {
  buildDocuments,
  buildPublication,
  buildUsers,
  buildWikiNodes,
  dbHooks,
  redisStore,
  resetDatabase,
  tables,
  WIKI_ID,
} from './helpers';

vi.mock('@colanode/server/data/database', async () => {
  const helpers = await import('./helpers');
  return { database: helpers.fakeDatabase };
});

vi.mock('@colanode/server/data/redis', async () => {
  const helpers = await import('./helpers');
  return { redis: helpers.fakeRedis };
});

vi.mock('@colanode/server/lib/storage', () => ({
  storage: { download: vi.fn() },
}));

const IP = '1.2.3.4';
const download = vi.mocked(storage.download);

let app: FastifyInstance;

const buildApp = async () => {
  const instance = fastify({ trustProxy: true });
  instance.decorateRequest('client');
  instance.addHook('onRequest', async (request) => {
    request.client = {
      ip: IP,
      platform: 'test',
      version: 'test',
      type: 'web',
    };
  });
  instance.register(wikiPublicRoutes);
  await instance.ready();
  return instance;
};

const setup = (publication: Record<string, unknown> = {}) => {
  resetDatabase({
    nodes: buildWikiNodes(),
    documents: buildDocuments(),
    users: buildUsers(),
    wiki_publications: [buildPublication(publication)],
    uploads: [
      {
        file_id: 'file-img',
        root_id: WIKI_ID,
        path: 'files/img',
        uploaded_at: new Date(),
      },
      {
        file_id: 'file-pdf',
        root_id: WIKI_ID,
        path: 'files/pdf',
        uploaded_at: new Date(),
      },
    ],
  });
};

// Publishes the wiki in link mode and returns a valid access token.
const setupLinkMode = () => {
  const { token, salt, hash } = generateWikiLinkToken(WIKI_ID);
  setup({ access: 'link', link_token_hash: hash, link_token_salt: salt });
  return token;
};

beforeEach(async () => {
  redisStore.clear();
  download.mockReset();
  setup();
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
});

describe('rate limit', () => {
  it('answers 429 once the reader made too many requests', async () => {
    redisStore.set(`rt:pw:${IP}`, '600');
    const response = await app.inject({ method: 'GET', url: '/wiki/docs' });

    expect(response.statusCode).toBe(429);
    expect(response.body).toContain('Trop de requêtes');
  });
});

describe('GET /s/:token', () => {
  it('stores the token in a cookie and redirects to the wiki', async () => {
    const token = setupLinkMode();
    const response = await app.inject({ method: 'GET', url: `/s/${token}` });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/wiki/docs');
    expect(response.headers['set-cookie']).toBe(
      `colanode_wiki=${token}; Path=/wiki/docs; HttpOnly; SameSite=Lax; Max-Age=7776000`
    );
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('marks the cookie secure over https', async () => {
    const token = setupLinkMode();
    const response = await app.inject({
      method: 'GET',
      url: `/s/${token}`,
      headers: { 'x-forwarded-proto': 'https' },
    });

    expect(response.headers['set-cookie']).toMatch(/; Secure$/);
  });

  it('answers 404 for malformed, unknown or revoked tokens', async () => {
    const malformed = await app.inject({ method: 'GET', url: '/s/abc' });
    expect(malformed.statusCode).toBe(404);
    expect(malformed.body).toContain('Page introuvable');

    // Valid format but for another wiki.
    const other = generateWikiLinkToken('x'.repeat(28)).token;
    expect(
      (await app.inject({ method: 'GET', url: `/s/${other}` })).statusCode
    ).toBe(404);

    // Right wiki, wrong secret.
    setupLinkMode();
    const wrong = generateWikiLinkToken(WIKI_ID).token;
    expect(
      (await app.inject({ method: 'GET', url: `/s/${wrong}` })).statusCode
    ).toBe(404);
  });
});

describe('GET /wiki/:slug/_assets/plantuml/:file', () => {
  it('serves the known PlantUML scripts', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_assets/plantuml/themes.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'text/javascript; charset=utf-8'
    );
    expect(response.headers['cache-control']).toBe('public, max-age=86400');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('refuses any other file', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_assets/plantuml/package.json',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /wiki/:slug/_files/:fileId/:name', () => {
  it('shows common images inline', async () => {
    download.mockResolvedValue({
      stream: Readable.from([Buffer.from('PNG')]),
    } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_files/file-img/diagram.png',
    });

    expect(response.statusCode).toBe(200);
    expect(download).toHaveBeenCalledWith('files/img');
    expect(response.body).toBe('PNG');
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['content-disposition']).toBe(
      "inline; filename*=UTF-8''diagram.png"
    );
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; sandbox"
    );
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.headers['x-robots-tag']).toBeUndefined();
  });

  it('downloads other files as attachments', async () => {
    download.mockResolvedValue({ stream: Readable.from(['PDF']) } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_files/file-pdf/guide.pdf',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''guide%20%C3%A9.pdf"
    );
  });

  it('falls back to a generic name and type for files without metadata', async () => {
    tables.nodes!.push({
      ...tables.nodes!.find((row) => row.id === 'file-img')!,
      id: 'file-bare',
      attributes: { type: 'file', status: 1 },
    });
    tables.uploads!.push({
      file_id: 'file-bare',
      root_id: WIKI_ID,
      path: 'files/bare',
      uploaded_at: new Date(),
    });
    download.mockResolvedValue({ stream: Readable.from(['x']) } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_files/file-bare/x',
    });

    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''fichier"
    );
  });

  it('keeps files of link wikis private', async () => {
    const token = setupLinkMode();
    download.mockResolvedValue({ stream: Readable.from(['PNG']) } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_files/file-img/diagram.png',
      headers: { cookie: `colanode_wiki=${encodeURIComponent(token)}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, max-age=300');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('answers 404 for unknown, pending or not uploaded files', async () => {
    const urls = [
      '/wiki/docs/_files/missing/x',
      '/wiki/docs/_files/file-pending/pending.png',
      '/wiki/docs/_files/cat/x',
      '/wiki/nope/_files/file-img/diagram.png',
    ];
    for (const url of urls) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }

    tables.uploads = [
      {
        file_id: 'file-img',
        root_id: WIKI_ID,
        path: 'files/img',
        uploaded_at: null,
      },
    ];
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/wiki/docs/_files/file-img/diagram.png',
        })
      ).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/wiki/docs/_files/file-pdf/guide.pdf',
        })
      ).statusCode
    ).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it('answers 404 when the storage fails', async () => {
    download.mockRejectedValue(new Error('gone'));
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_files/file-img/diagram.png',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /wiki/:slug/_search', () => {
  it('asks for words without a query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_search',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers['content-security-policy']).toContain('nonce-');
    expect(response.body).toContain('Saisissez un ou plusieurs mots');
  });

  it('lists the results', async () => {
    const many = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_search?q=installation',
    });
    expect(many.body).toContain('2 résultats pour « installation »');
    expect(many.body).toContain(
      '<li><a href="/wiki/docs/guides/installation">Installation</a><p>'
    );

    const one = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_search?q=nested',
    });
    expect(one.body).toContain('1 résultat pour « nested »');

    // A result without text has no excerpt.
    const bare = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_search?q=guides',
    });
    expect(bare.body).toContain(
      '<li><a href="/wiki/docs/guides">Guides</a></li>'
    );
  });

  it('says when nothing matches', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/_search?q=%3Cnothing%3E',
    });
    expect(response.body).toContain('Aucun résultat pour « &lt;nothing&gt; »');
  });

  it('answers 404 for unreadable wikis', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/nope/_search?q=x',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /wiki/:slug/sitemap.xml', () => {
  it('lists every page of a public wiki', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/sitemap.xml',
      headers: { host: 'docs.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/xml; charset=utf-8'
    );
    expect(response.body).toContain(
      '<url><loc>http://docs.example.com/wiki/docs</loc></url>'
    );
    expect(response.body).toContain(
      '<url><loc>http://docs.example.com/wiki/docs/guides/tasks/first-task</loc></url>'
    );
  });

  it('is not served for link wikis, even to readers with access', async () => {
    const token = setupLinkMode();
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/sitemap.xml',
      headers: { cookie: `colanode_wiki=${token}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /wiki/:slug and /wiki/:slug/*', () => {
  it('renders the wiki home', async () => {
    const response = await app.inject({ method: 'GET', url: '/wiki/docs' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('same-origin');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['x-robots-tag']).toBeUndefined();
    expect(response.body).toContain('Docs');
    // Routes are recorded for later redirects.
    expect(tables.wiki_routes!.length).toBeGreaterThan(0);
  });

  it('renders a page with its canonical address', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/Guides/Installation/',
      headers: { host: 'docs.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Getting started');
    expect(response.body).toContain(
      'http://docs.example.com/wiki/docs/guides/installation'
    );
  });

  it('redirects old addresses to the current ones', async () => {
    tables.wiki_routes = [
      { wiki_id: WIKI_ID, path: 'old/install', node_id: 'page-install' },
      { wiki_id: WIKI_ID, path: 'old-home', node_id: WIKI_ID },
    ];

    const page = await app.inject({
      method: 'GET',
      url: '/wiki/docs/old/install',
    });
    expect(page.statusCode).toBe(301);
    expect(page.headers.location).toBe('/wiki/docs/guides/installation');

    const home = await app.inject({
      method: 'GET',
      url: '/wiki/docs/old-home',
    });
    expect(home.statusCode).toBe(301);
    expect(home.headers.location).toBe('/wiki/docs');
  });

  it('answers 404 for unknown pages, slugs and invalid slugs', async () => {
    for (const url of [
      '/wiki/docs/does/not/exist',
      '/wiki/unknown',
      '/wiki/ab',
      '/wiki/admin',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
  });

  it('answers 404 when the wiki node is gone', async () => {
    tables.nodes = tables.nodes!.filter((row) => row.id !== WIKI_ID);
    const response = await app.inject({ method: 'GET', url: '/wiki/docs' });
    expect(response.statusCode).toBe(404);
  });

  it('still renders when the routes cannot be saved', async () => {
    dbHooks.beforeExecute = (query) => {
      if (query.table === 'wiki_routes') {
        throw new Error('database down');
      }
    };
    const response = await app.inject({
      method: 'GET',
      url: '/wiki/docs/guides',
    });
    expect(response.statusCode).toBe(200);
  });

  it('requires the access cookie for link wikis', async () => {
    const token = setupLinkMode();

    const anonymous = await app.inject({ method: 'GET', url: '/wiki/docs' });
    expect(anonymous.statusCode).toBe(404);

    const wrong = await app.inject({
      method: 'GET',
      url: '/wiki/docs',
      headers: { cookie: 'colanode_wiki=cwl_invalid' },
    });
    expect(wrong.statusCode).toBe(404);

    const reader = await app.inject({
      method: 'GET',
      url: '/wiki/docs/guides',
      headers: {
        cookie: `other=1; colanode_wiki=${encodeURIComponent(token)}`,
      },
    });
    expect(reader.statusCode).toBe(200);
    expect(reader.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(reader.body).not.toContain('rel="canonical"');
  });
});
