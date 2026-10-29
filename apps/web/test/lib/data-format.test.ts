import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DATA_FORMAT_OPTIONS,
  detectDataFormat,
  formatData,
  sortDataKeys,
} from '@colanode/ui/lib/data-format';

describe('lib/data-format', () => {
  it('detects JSON and YAML', () => {
    expect(detectDataFormat('  {"a": 1}')).toBe('json');
    expect(detectDataFormat('[1, 2]')).toBe('json');
    expect(detectDataFormat('a: 1')).toBe('yaml');
  });

  it('pretty prints JSON with the chosen indentation', () => {
    const result = formatData('{"a":1,"b":[true]}', {
      ...DEFAULT_DATA_FORMAT_OPTIONS,
      indent: 4,
    });
    expect(result).toMatchObject({
      ok: true,
      input: 'json',
      output: '{\n    "a": 1,\n    "b": [\n        true\n    ]\n}',
    });
  });

  it('minifies JSON', () => {
    const result = formatData('{\n  "a": 1\n}', {
      ...DEFAULT_DATA_FORMAT_OPTIONS,
      minify: true,
    });
    expect(result).toMatchObject({ ok: true, output: '{"a":1}' });
  });

  it('converts between JSON and YAML', () => {
    expect(
      formatData('{"name":"Colanode","tags":["a","b"]}', {
        ...DEFAULT_DATA_FORMAT_OPTIONS,
        output: 'yaml',
      })
    ).toMatchObject({
      ok: true,
      output: 'name: Colanode\ntags:\n  - a\n  - b\n',
    });

    expect(
      formatData('name: Colanode\ncount: 2\n', DEFAULT_DATA_FORMAT_OPTIONS)
    ).toMatchObject({
      ok: true,
      input: 'yaml',
      output: '{\n  "name": "Colanode",\n  "count": 2\n}',
    });
  });

  it('sorts keys at every level', () => {
    expect(sortDataKeys({ b: 1, a: { d: 1, c: [{ f: 1, e: 2 }] } })).toEqual({
      a: { c: [{ e: 2, f: 1 }], d: 1 },
      b: 1,
    });
    expect(JSON.stringify(sortDataKeys({ b: 1, a: { d: 1, c: 2 } }))).toBe(
      '{"a":{"c":2,"d":1},"b":1}'
    );
  });

  // Recent V8 versions no longer give the position of JSON errors, so only
  // the message is guaranteed.
  it('reports JSON errors', () => {
    const result = formatData('{\n  "a": 1,\n  "b": \n}', {
      ...DEFAULT_DATA_FORMAT_OPTIONS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.input).toBe('json');
      expect(result.error.message).toContain('not valid JSON');
    }
  });

  it('reports the location of YAML errors', () => {
    const result = formatData('a: 1\nb: [1, 2\n', DEFAULT_DATA_FORMAT_OPTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.input).toBe('yaml');
      expect(result.error.line).toBeGreaterThan(0);
    }
  });
});
