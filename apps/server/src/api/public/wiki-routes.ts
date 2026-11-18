import { randomBytes } from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';

import { isValidWikiSlug } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectWikiPublication } from '@colanode/server/data/schema';
import { generateOrigin } from '@colanode/server/lib/fastify';
import { createLogger } from '@colanode/server/lib/logger';
import {
  isPublicIpRateLimited,
  isPublicSearchRateLimited,
} from '@colanode/server/lib/rate-limits';
import { storage } from '@colanode/server/lib/storage';
import { escapeHtml } from '@colanode/server/lib/wikis/html';
import {
  buildWikiCsp,
  renderWikiPage,
} from '@colanode/server/lib/wikis/layout';
import { normalizeWikiPath } from '@colanode/server/lib/wikis/paths';
import {
  buildWikiPathPrefix,
  parseWikiLinkToken,
  readCookie,
  verifyWikiLinkToken,
  wikiAccessCookieName,
  wikiAccessCookiePath,
} from '@colanode/server/lib/wikis/publications';
import {
  getPublicationBySlug,
  getReadableWiki,
  getWikiNodeRender,
  getWikiTexts,
  ReadableWiki,
} from '@colanode/server/lib/wikis/readable';
import { INLINE_IMAGE_TYPES } from '@colanode/server/lib/wikis/render-blocks';
import {
  isPublicFile,
  resolveWikiPath,
  searchWiki,
  wikiHref,
} from '@colanode/server/lib/wikis/service';

const logger = createLogger('server:wiki');

const PLANTUML_ASSETS = new Set(['plantuml.js', 'viz-global.js', 'themes.js']);

// The PlantUML engine is rendered in the reader's browser. It is optional:
// without the package, diagrams stay as source code.
const resolvePlantUmlDir = (): string | null => {
  try {
    const require = createRequire(import.meta.url);
    return path.dirname(require.resolve('@plantuml/core/package.json'));
  } catch {
    return null;
  }
};

const plantUmlDir = resolvePlantUmlDir();

const setPageHeaders = (
  reply: FastifyReply,
  nonce: string,
  indexable: boolean
) => {
  reply.header('Content-Security-Policy', buildWikiCsp(nonce));
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'same-origin');
  reply.header('Cache-Control', indexable ? 'no-cache' : 'private, no-cache');
  if (!indexable) {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
  }
};

const sendNotFound = (reply: FastifyReply) => {
  reply.header('X-Robots-Tag', 'noindex, nofollow');
  return reply
    .code(404)
    .type('text/html; charset=utf-8')
    .send(
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page introuvable</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>Page introuvable</h1><p>Cette page n\'existe pas, n\'est plus publiée, ou demande un lien d\'accès.</p></body></html>'
    );
};

const hasReaderAccess = (
  request: FastifyRequest,
  publication: SelectWikiPublication
): boolean => {
  if (publication.access === 'public') {
    return true;
  }

  const token = readCookie(
    request.headers.cookie,
    wikiAccessCookieName(publication.wiki_id)
  );
  return verifyWikiLinkToken(publication, token);
};

// Loads a published wiki the reader may see, or null (answered as 404 so
// that private wikis are not revealed).
const loadReadableWiki = async (
  request: FastifyRequest,
  slug: string,
  reuse = false
): Promise<ReadableWiki | null> => {
  if (!isValidWikiSlug(slug)) {
    return null;
  }

  const publication = await getPublicationBySlug(slug, reuse);
  if (!publication || !hasReaderAccess(request, publication)) {
    return null;
  }

  return getReadableWiki(publication, buildWikiPathPrefix(slug), reuse);
};

const isRateLimitedSafely = async (
  check: (ip: string) => Promise<boolean>,
  ip: string
): Promise<boolean> => {
  try {
    return await check(ip);
  } catch (error) {
    // Readers keep access when Redis is unavailable.
    logger.warn(error, 'Rate limit unavailable for public wiki');
    return false;
  }
};

type WikiParams = { slug: string; '*'?: string };

export const wikiPublicRoutes: FastifyPluginCallback = (instance, _, done) => {
  instance.addHook('onRequest', async (request, reply) => {
    if (await isRateLimitedSafely(isPublicIpRateLimited, request.client.ip)) {
      return reply
        .code(429)
        .type('text/plain')
        .send('Trop de requêtes, réessayez dans quelques minutes.');
    }
  });

  // Access link: stores the secret in a cookie limited to the wiki, then
  // sends the reader to the readable address.
  instance.get<{ Params: { token: string } }>(
    '/s/:token',
    async (request, reply) => {
      const parsed = parseWikiLinkToken(request.params.token);
      if (!parsed) {
        return sendNotFound(reply);
      }

      const publication = await database
        .selectFrom('wiki_publications')
        .selectAll()
        .where('wiki_id', '=', parsed.wikiId)
        .executeTakeFirst();

      if (
        !publication ||
        !verifyWikiLinkToken(publication, request.params.token)
      ) {
        return sendNotFound(reply);
      }

      const cookieName = wikiAccessCookieName(publication.wiki_id);
      const secure = request.protocol === 'https' ? '; Secure' : '';
      reply.header(
        'Set-Cookie',
        `${cookieName}=${encodeURIComponent(request.params.token)}; Path=${wikiAccessCookiePath()}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}${secure}`
      );
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      return reply.redirect(buildWikiPathPrefix(publication.slug), 302);
    }
  );

  instance.get<{ Params: { slug: string; file: string } }>(
    '/wiki/:slug/_assets/plantuml/:file',
    async (request, reply) => {
      if (!plantUmlDir || !PLANTUML_ASSETS.has(request.params.file)) {
        return reply.code(404).send();
      }

      const stream = fs.createReadStream(
        path.join(plantUmlDir, request.params.file)
      );
      reply.header('Content-Type', 'text/javascript; charset=utf-8');
      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.send(stream);
    }
  );

  instance.get<{ Params: { slug: string; fileId: string; name: string } }>(
    '/wiki/:slug/_files/:fileId/:name',
    async (request, reply) => {
      const entry = await loadReadableWiki(request, request.params.slug, true);
      const wiki = entry?.wiki ?? null;
      const file = wiki ? isPublicFile(wiki, request.params.fileId) : null;
      if (!wiki || !file) {
        return sendNotFound(reply);
      }

      const upload = await database
        .selectFrom('uploads')
        .selectAll()
        .where('file_id', '=', file.id)
        .where('root_id', '=', wiki.wiki.id)
        .executeTakeFirst();

      if (!upload || !upload.uploaded_at) {
        return sendNotFound(reply);
      }

      try {
        const { stream } = await storage.download(upload.path);
        const mimeType =
          (file.attributes as { mimeType?: string }).mimeType ?? '';
        const inline = INLINE_IMAGE_TYPES.has(mimeType);
        const name = (file.attributes as { name?: string }).name ?? 'fichier';

        // Only common images are shown in the page. Everything else, SVG
        // included, is downloaded and never rendered on this origin.
        reply.header(
          'Content-Type',
          inline ? mimeType : 'application/octet-stream'
        );
        reply.header(
          'Content-Disposition',
          `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`
        );
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('Content-Security-Policy', "default-src 'none'; sandbox");
        reply.header(
          'Cache-Control',
          wiki.publication.access === 'public'
            ? 'public, max-age=300'
            : 'private, max-age=300'
        );
        if (wiki.publication.access !== 'public') {
          reply.header('X-Robots-Tag', 'noindex, nofollow');
        }
        return reply.send(stream);
      } catch {
        return sendNotFound(reply);
      }
    }
  );

  instance.get<{ Params: { slug: string }; Querystring: { q?: string } }>(
    '/wiki/:slug/_search',
    async (request, reply) => {
      const entry = await loadReadableWiki(request, request.params.slug);
      const wiki = entry?.wiki ?? null;
      if (!wiki) {
        return sendNotFound(reply);
      }

      const query = String(request.query.q ?? '').slice(0, 200);
      if (
        query &&
        (await isRateLimitedSafely(
          isPublicSearchRateLimited,
          request.client.ip
        ))
      ) {
        return reply
          .code(429)
          .type('text/plain')
          .send('Trop de recherches, réessayez dans quelques minutes.');
      }

      const results =
        query && entry
          ? await searchWiki(wiki, query, await getWikiTexts(entry))
          : [];
      const list = results
        .map(
          (result) =>
            `<li><a href="${escapeHtml(result.href)}">${escapeHtml(result.title)}</a>${result.excerpt ? `<p>${escapeHtml(result.excerpt)}</p>` : ''}</li>`
        )
        .join('');
      const contentHtml = !query
        ? '<p class="muted">Saisissez un ou plusieurs mots dans la barre de recherche.</p>'
        : results.length === 0
          ? `<p class="muted">Aucun résultat pour « ${escapeHtml(query)} ».</p>`
          : `<p class="muted">${results.length} résultat${results.length > 1 ? 's' : ''} pour « ${escapeHtml(query)} »</p><ul class="results">${list}</ul>`;

      const nonce = randomBytes(16).toString('base64');
      setPageHeaders(reply, nonce, false);
      return reply.type('text/html; charset=utf-8').send(
        renderWikiPage({
          wiki,
          nodeId: '',
          title: 'Recherche',
          contentHtml,
          headings: [],
          updatedAt: null,
          description: null,
          nonce,
          canonicalUrl: null,
          indexable: false,
          searchQuery: query,
          withPager: false,
        })
      );
    }
  );

  instance.get<{ Params: { slug: string } }>(
    '/wiki/:slug/sitemap.xml',
    async (request, reply) => {
      const entry = await loadReadableWiki(request, request.params.slug);
      const wiki = entry?.wiki ?? null;
      if (!wiki || wiki.publication.access !== 'public') {
        return sendNotFound(reply);
      }

      const origin = generateOrigin(request);
      const urls = [...wiki.tree.paths.keys()]
        .map((id) => wikiHref(wiki, id))
        .filter((href): href is string => href !== null)
        .map((href) => `<url><loc>${escapeHtml(origin + href)}</loc></url>`)
        .join('');

      return reply
        .type('application/xml; charset=utf-8')
        .send(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
        );
    }
  );

  const handlePage = async (
    request: FastifyRequest<{ Params: WikiParams }>,
    reply: FastifyReply
  ) => {
    const entry = await loadReadableWiki(request, request.params.slug);
    const wiki = entry?.wiki ?? null;
    if (!entry || !wiki) {
      return sendNotFound(reply);
    }

    const requested = normalizeWikiPath(request.params['*']);
    const resolution = await resolveWikiPath(wiki, requested);
    if (resolution.type === 'not_found') {
      return sendNotFound(reply);
    }

    if (resolution.type === 'redirect') {
      const target = resolution.path
        ? `${wiki.basePath}/${resolution.path}`
        : wiki.basePath;
      return reply.redirect(target, 301);
    }

    // Unchanged page: the browser keeps its copy. The render time is part
    // of the tag so that refreshed user names reach returning readers.
    const render = await getWikiNodeRender(entry, resolution.nodeId);
    const content = render.content;
    const etag = `W/"${entry.version}-${resolution.nodeId}-${render.at}"`;
    reply.header('ETag', etag);
    if (request.headers['if-none-match'] === etag) {
      reply.header(
        'Cache-Control',
        wiki.publication.access === 'public' ? 'no-cache' : 'private, no-cache'
      );
      return reply.code(304).send();
    }

    const indexable = wiki.publication.access === 'public';
    const href = wikiHref(wiki, resolution.nodeId);
    const origin = generateOrigin(request);

    const nonce = randomBytes(16).toString('base64');
    setPageHeaders(reply, nonce, indexable);
    return reply.type('text/html; charset=utf-8').send(
      renderWikiPage({
        wiki,
        nodeId: resolution.nodeId,
        title: content.title,
        contentHtml: content.html,
        headings: content.headings,
        updatedAt: content.updatedAt,
        description: content.description,
        nonce,
        canonicalUrl: indexable && href ? origin + href : null,
        indexable,
      })
    );
  };

  instance.get<{ Params: WikiParams }>('/wiki/:slug', handlePage);
  instance.get<{ Params: WikiParams }>('/wiki/:slug/*', handlePage);

  done();
};
