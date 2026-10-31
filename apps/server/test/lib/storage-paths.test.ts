import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FileSystemStorage } from '@colanode/server/lib/storage/fs';
import { buildFileUploadPath } from '@colanode/server/lib/storage/paths';

describe('buildFileUploadPath', () => {
  it('builds the path of a regular file', () => {
    expect(buildFileUploadPath('wk', 'file', 'v1', '.tar.gz')).toBe(
      'files/wk/file_v1.tar.gz'
    );
    expect(buildFileUploadPath('wk', 'file', 'v1', '')).toBe(
      'files/wk/file_v1'
    );
  });

  it.each([
    ['extension', 'wk', 'file', 'v1', '/../../other/secret.pdf'],
    ['windows extension', 'wk', 'file', 'v1', '\\..\\..\\secret.pdf'],
    ['null byte', 'wk', 'file', 'v1', '.pdf\0.txt'],
    ['version', 'wk', 'file', '/../../v1', '.pdf'],
    ['file id', 'wk', '../../file', 'v1', '.pdf'],
  ])('refuses a separator in the %s', (_, workspace, file, version, ext) => {
    expect(buildFileUploadPath(workspace, file, version, ext)).toBeNull();
  });

  it('refuses a path too long for the uploads table', () => {
    const extension = `.${'a'.repeat(300)}`;
    expect(buildFileUploadPath('wk', 'file', 'v1', extension)).toBeNull();
  });
});

describe('FileSystemStorage', () => {
  let root: string;
  let storage: FileSystemStorage;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'colanode-storage-'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'outside.txt'), 'outside');

    storage = new FileSystemStorage(
      { type: 'file', directory: path.join(root, 'data') },
      { cache: { type: 'none' } } as never
    );
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps reading and writing inside of the directory', async () => {
    await storage.upload('files/wk/a.txt', Buffer.from('a'), 'text/plain');
    const { stream } = await storage.download('files/wk/a.txt');

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }

    expect(Buffer.concat(chunks).toString()).toBe('a');
    await storage.delete('files/wk/a.txt');
    expect(fs.existsSync(path.join(root, 'data/files/wk/a.txt'))).toBe(false);
  });

  it('refuses to read or write outside of the directory', async () => {
    await expect(storage.download('../outside.txt')).rejects.toThrow();
    await expect(
      storage.upload('../outside.txt', Buffer.from('x'), 'text/plain')
    ).rejects.toThrow();
    await expect(storage.download('../data')).rejects.toThrow();

    expect(fs.readFileSync(path.join(root, 'outside.txt'), 'utf8')).toBe(
      'outside'
    );
  });

  it('ignores a delete outside of the directory without failing', async () => {
    await expect(storage.delete('../outside.txt')).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(root, 'outside.txt'))).toBe(true);
  });
});
