import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  pathPrefix: undefined as string | undefined,
  publicUrl: undefined as string | undefined,
}));

vi.mock('@colanode/server/lib/config', () => ({ config: mockConfig }));

const { generateOrigin, generateUrl } =
  await import('@colanode/server/lib/fastify');

const request = (values: Record<string, unknown>) =>
  values as unknown as Parameters<typeof generateOrigin>[0];

describe('server URLs', () => {
  beforeEach(() => {
    mockConfig.pathPrefix = undefined;
    mockConfig.publicUrl = undefined;
  });

  it('builds the address from the request, without default ports', () => {
    expect(
      generateUrl(
        request({ protocol: 'https', hostname: 'api.test', port: 443 }),
        '/config'
      )
    ).toBe('https://api.test/config');
    expect(
      generateOrigin(
        request({ protocol: 'http', hostname: 'localhost', port: 3000 })
      )
    ).toBe('http://localhost:3000');
  });

  it('prefers the configured public address, prefix after the origin', () => {
    mockConfig.publicUrl = 'https://wiki.example.com/';
    mockConfig.pathPrefix = 'wiki';
    const req = request({ protocol: 'http', hostname: 'evil.test', port: 80 });

    // The origin is never mangled, even when the host starts like the prefix.
    expect(generateOrigin(req)).toBe('https://wiki.example.com');
    expect(generateUrl(req, '/wiki/docs')).toBe(
      'https://wiki.example.com/wiki/wiki/docs'
    );
  });
});
