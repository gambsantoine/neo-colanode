import { describe, expect, it } from 'vitest';

import { escapeHtml, isSafeUrl } from '@colanode/server/lib/wikis/html';

describe('escapeHtml', () => {
  it('escapes every HTML special character', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies other values', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(false)).toBe('false');
    expect(escapeHtml('plain text')).toBe('plain text');
  });

  it('does not double-escape in a single pass', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('isSafeUrl', () => {
  it.each([
    'http://example.com',
    'https://example.com/path?q=1#x',
    'mailto:someone@example.com',
  ])('accepts %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'ftp://example.com',
    'file:///etc/passwd',
    '/relative/path',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(123)).toBe(false);
    expect(isSafeUrl({ href: 'https://example.com' })).toBe(false);
  });
});
