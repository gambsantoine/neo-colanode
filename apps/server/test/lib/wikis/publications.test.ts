import { FastifyRequest } from 'fastify';
import { sha256 } from 'js-sha256';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateId, IdType } from '@colanode/core';
import { SelectWikiPublication } from '@colanode/server/data/schema';
import {
  buildServerBaseUrl,
  buildWikiPathPrefix,
  generateWikiLinkToken,
  mapWikiPublication,
  parseWikiLinkToken,
  readCookie,
  verifyWikiLinkToken,
  wikiAccessCookieName,
  wikiAccessCookiePath,
} from '@colanode/server/lib/wikis/publications';

const mockConfig = vi.hoisted(() => ({
  pathPrefix: undefined as string | undefined,
}));

vi.mock('@colanode/server/lib/config', () => ({ config: mockConfig }));

const wikiId = generateId(IdType.Wiki);

const publication = (
  overrides: Partial<SelectWikiPublication> = {}
): SelectWikiPublication => ({
  wiki_id: wikiId,
  workspace_id: 'ws',
  slug: 'docs',
  access: 'public',
  home_node_id: null,
  link_token_hash: null,
  link_token_salt: null,
  created_at: new Date('2026-01-02T03:04:05.000Z'),
  created_by: 'user',
  updated_at: null,
  updated_by: null,
  ...overrides,
});

const request = (values: {
  protocol: string;
  hostname: string;
  port?: number;
}): FastifyRequest => values as unknown as FastifyRequest;

beforeEach(() => {
  mockConfig.pathPrefix = undefined;
});

describe('wiki link tokens', () => {
  it('uses a 28 characters wiki id', () => {
    expect(wikiId).toHaveLength(28);
  });

  it('generates a token that parses back to its wiki and verifies', () => {
    const { token, salt, hash } = generateWikiLinkToken(wikiId);
    expect(token.startsWith(`cwl_${wikiId}`)).toBe(true);

    const parsed = parseWikiLinkToken(token);
    expect(parsed?.wikiId).toBe(wikiId);
    expect(parsed?.secret).toHaveLength(64);
    expect(sha256(parsed!.secret + salt)).toBe(hash);

    const pub = publication({ link_token_hash: hash, link_token_salt: salt });
    expect(verifyWikiLinkToken(pub, token)).toBe(true);
  });

  it('generates distinct tokens', () => {
    const a = generateWikiLinkToken(wikiId);
    const b = generateWikiLinkToken(wikiId);
    expect(a.token).not.toBe(b.token);
    expect(a.salt).not.toBe(b.salt);
  });

  it('rejects tokens with a wrong prefix', () => {
    const { token } = generateWikiLinkToken(wikiId);
    expect(parseWikiLinkToken(token.replace('cwl_', 'xxx_'))).toBeNull();
    expect(parseWikiLinkToken('')).toBeNull();
  });

  it('rejects tokens with a too short id or secret', () => {
    expect(parseWikiLinkToken('cwl_short')).toBeNull();
    expect(parseWikiLinkToken(`cwl_${wikiId}${'a'.repeat(31)}`)).toBeNull();
    expect(parseWikiLinkToken(`cwl_${wikiId}${'a'.repeat(32)}`)).toEqual({
      wikiId,
      secret: 'a'.repeat(32),
    });
  });

  describe('verifyWikiLinkToken', () => {
    const { token, salt, hash } = generateWikiLinkToken(wikiId);
    const withLink = publication({
      link_token_hash: hash,
      link_token_salt: salt,
    });

    it('rejects a missing token', () => {
      expect(verifyWikiLinkToken(withLink, null)).toBe(false);
      expect(verifyWikiLinkToken(withLink, undefined)).toBe(false);
      expect(verifyWikiLinkToken(withLink, '')).toBe(false);
    });

    it('rejects when the publication has no link hash or salt', () => {
      expect(
        verifyWikiLinkToken(publication({ link_token_salt: salt }), token)
      ).toBe(false);
      expect(
        verifyWikiLinkToken(publication({ link_token_hash: hash }), token)
      ).toBe(false);
    });

    it('rejects an unparsable token', () => {
      expect(verifyWikiLinkToken(withLink, 'garbage')).toBe(false);
    });

    it('rejects a token for another wiki', () => {
      const other = generateId(IdType.Wiki);
      const secret = parseWikiLinkToken(token)!.secret;
      expect(verifyWikiLinkToken(withLink, `cwl_${other}${secret}`)).toBe(
        false
      );
    });

    it('rejects a token with a wrong secret', () => {
      const forged = `cwl_${wikiId}${'0'.repeat(64)}`;
      expect(verifyWikiLinkToken(withLink, forged)).toBe(false);
    });

    it('rejects a token after the link was regenerated', () => {
      const next = generateWikiLinkToken(wikiId);
      const regenerated = publication({
        link_token_hash: next.hash,
        link_token_salt: next.salt,
      });
      expect(verifyWikiLinkToken(regenerated, token)).toBe(false);
      expect(verifyWikiLinkToken(regenerated, next.token)).toBe(true);
    });
  });
});

describe('buildServerBaseUrl', () => {
  it('omits default ports', () => {
    expect(
      buildServerBaseUrl(
        request({ protocol: 'https', hostname: 'example.com', port: 443 })
      )
    ).toBe('https://example.com');
    expect(
      buildServerBaseUrl(
        request({ protocol: 'http', hostname: 'example.com', port: 80 })
      )
    ).toBe('http://example.com');
    expect(
      buildServerBaseUrl(request({ protocol: 'http', hostname: 'example.com' }))
    ).toBe('http://example.com');
  });

  it('keeps custom ports', () => {
    expect(
      buildServerBaseUrl(
        request({ protocol: 'http', hostname: 'localhost', port: 3000 })
      )
    ).toBe('http://localhost:3000');
  });

  it('appends the configured path prefix', () => {
    mockConfig.pathPrefix = 'colanode';
    expect(
      buildServerBaseUrl(
        request({ protocol: 'https', hostname: 'example.com', port: 8443 })
      )
    ).toBe('https://example.com:8443/colanode');
  });
});

describe('buildWikiPathPrefix', () => {
  it('builds the wiki path without prefix', () => {
    expect(buildWikiPathPrefix('docs')).toBe('/wiki/docs');
  });

  it('builds the wiki path with the configured prefix', () => {
    mockConfig.pathPrefix = 'app';
    expect(buildWikiPathPrefix('docs')).toBe('/app/wiki/docs');
  });
});

describe('mapWikiPublication', () => {
  it('maps a publication without link nor update', () => {
    expect(mapWikiPublication(publication(), 'https://x.test/p')).toEqual({
      wikiId,
      slug: 'docs',
      access: 'public',
      homeNodeId: null,
      url: 'https://x.test/p/wiki/docs',
      hasLink: false,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: null,
    });
  });

  it('maps a publication with a link and an update date', () => {
    const output = mapWikiPublication(
      publication({
        access: 'link',
        home_node_id: 'home',
        link_token_hash: 'h',
        link_token_salt: 's',
        updated_at: new Date('2026-03-04T00:00:00.000Z'),
      }),
      'http://localhost:3000'
    );
    expect(output).toMatchObject({
      access: 'link',
      homeNodeId: 'home',
      hasLink: true,
      updatedAt: '2026-03-04T00:00:00.000Z',
    });
  });
});

describe('readCookie', () => {
  it('names the access cookie after the wiki and scopes it to all wikis', () => {
    expect(wikiAccessCookieName('wiki1')).toBe('colanode_wiki_wiki1');
    expect(wikiAccessCookiePath()).toBe('/wiki/');
  });

  it('returns null without header', () => {
    expect(readCookie(undefined, 'a')).toBeNull();
    expect(readCookie('', 'a')).toBeNull();
  });

  it('finds a cookie among others, ignoring spaces', () => {
    expect(readCookie('a=1;  b=2 ; c=3', 'b')).toBe('2');
    expect(readCookie('a=1', 'a')).toBe('1');
  });

  it('returns null when the cookie is absent', () => {
    expect(readCookie('a=1; b=2', 'c')).toBeNull();
  });

  it('does not match a cookie whose name only starts with the name', () => {
    expect(readCookie('colanode_wiki_old=x', 'colanode_wiki')).toBeNull();
  });

  it('keeps equal signs inside the value', () => {
    expect(readCookie('t=abc==; x=1', 't')).toBe('abc==');
  });

  it('decodes the value', () => {
    expect(readCookie('t=a%20b%3Bc', 't')).toBe('a b;c');
  });

  it('returns an empty value for a cookie without value', () => {
    expect(readCookie('t', 't')).toBe('');
    expect(readCookie('t=', 't')).toBe('');
  });

  it('returns null for a malformed encoded value', () => {
    expect(readCookie('t=%E0%A4%A', 't')).toBeNull();
  });

  it('returns the first matching cookie', () => {
    expect(readCookie('t=first; t=second', 't')).toBe('first');
  });
});
