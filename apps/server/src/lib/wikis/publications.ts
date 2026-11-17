import { FastifyRequest } from 'fastify';
import { sha256 } from 'js-sha256';

import { WikiPublicationOutput } from '@colanode/core';
import { SelectWikiPublication } from '@colanode/server/data/schema';
import { config } from '@colanode/server/lib/config';
import { uuid } from '@colanode/server/lib/utils';

const WIKI_LINK_TOKEN_PREFIX = 'cwl_';
const ID_LENGTH = 28;

const WIKI_ACCESS_COOKIE = 'colanode_wiki';

// One cookie per wiki, scoped to every wiki address: changing the address
// of a wiki keeps its readers signed in.
export const wikiAccessCookieName = (wikiId: string): string =>
  `${WIKI_ACCESS_COOKIE}_${wikiId}`;

export const wikiAccessCookiePath = (): string => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';
  return `${prefix}/wiki/`;
};

export const generateWikiLinkToken = (wikiId: string) => {
  const salt = uuid();
  const secret = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  const hash = sha256(secret + salt);
  const token = WIKI_LINK_TOKEN_PREFIX + wikiId + secret;

  return { token, salt, hash };
};

export const parseWikiLinkToken = (
  token: string
): { wikiId: string; secret: string } | null => {
  if (!token.startsWith(WIKI_LINK_TOKEN_PREFIX)) {
    return null;
  }

  const rest = token.slice(WIKI_LINK_TOKEN_PREFIX.length);
  const wikiId = rest.slice(0, ID_LENGTH);
  const secret = rest.slice(ID_LENGTH);
  if (wikiId.length !== ID_LENGTH || secret.length < 32) {
    return null;
  }

  return { wikiId, secret };
};

export const verifyWikiLinkToken = (
  publication: SelectWikiPublication,
  token: string | null | undefined
): boolean => {
  if (!token || !publication.link_token_hash || !publication.link_token_salt) {
    return false;
  }

  const parsed = parseWikiLinkToken(token);
  if (!parsed || parsed.wikiId !== publication.wiki_id) {
    return false;
  }

  return (
    sha256(parsed.secret + publication.link_token_salt) ===
    publication.link_token_hash
  );
};

// Base address of the server (scheme, host and path prefix).
export const buildServerBaseUrl = (request: FastifyRequest): string => {
  const port =
    request.port && request.port != 80 && request.port != 443
      ? `:${request.port}`
      : '';
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';
  return `${request.protocol}://${request.hostname}${port}${prefix}`;
};

export const buildWikiPathPrefix = (slug: string): string => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';
  return `${prefix}/wiki/${slug}`;
};

export const mapWikiPublication = (
  publication: SelectWikiPublication,
  baseUrl: string
): WikiPublicationOutput => {
  return {
    wikiId: publication.wiki_id,
    slug: publication.slug,
    access: publication.access,
    homeNodeId: publication.home_node_id,
    url: `${baseUrl}/wiki/${publication.slug}`,
    hasLink: publication.link_token_hash !== null,
    createdAt: publication.created_at.toISOString(),
    updatedAt: publication.updated_at?.toISOString() ?? null,
  };
};

export const readCookie = (
  header: string | undefined,
  name: string
): string | null => {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }

  return null;
};
