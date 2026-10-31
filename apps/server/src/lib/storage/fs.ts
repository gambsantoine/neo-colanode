import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve, sep } from 'path';
import { Readable } from 'stream';

import { FileStore } from '@tus/file-store';
import { DataStore } from '@tus/server';

import { redis } from '@colanode/server/data/redis';
import type {
  FileStorageProviderConfig,
  TusConfig,
} from '@colanode/server/lib/config/storage';
import { createLogger } from '@colanode/server/lib/logger';
import { RedisKvStore } from '@colanode/server/lib/storage/tus/redis-kv';

import type { Storage } from './core';

const logger = createLogger('server:storage:fs');

export class FileSystemStorage implements Storage {
  private readonly directory: string;
  private readonly store: DataStore;

  constructor(config: FileStorageProviderConfig, tusConfig: TusConfig) {
    this.directory = config.directory;
    this.store = new FileStore({
      directory: this.directory,
      configstore:
        tusConfig.cache.type === 'redis'
          ? new RedisKvStore(redis, tusConfig.cache.prefix)
          : undefined,
    });
  }

  public get tusStore(): DataStore {
    return this.store;
  }

  // Stored paths come from the database and may predate path validation.
  private resolvePath(path: string): string | null {
    const root = resolve(this.directory);
    const fullPath = resolve(root, path);
    return fullPath.startsWith(root + sep) ? fullPath : null;
  }

  private requirePath(path: string): string {
    const fullPath = this.resolvePath(path);
    if (!fullPath) {
      throw new Error('Path is outside of the storage directory');
    }

    return fullPath;
  }

  async download(
    path: string
  ): Promise<{ stream: Readable; contentType?: string }> {
    const stream = createReadStream(this.requirePath(path));

    return {
      stream,
      contentType: undefined,
    };
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.resolvePath(path);
    if (!fullPath) {
      // Not an error: cleanup jobs must still be able to drop the upload row.
      logger.warn({ path }, 'Ignored delete outside of the storage directory');
      return;
    }

    await fs.unlink(fullPath);
  }

  async upload(
    path: string,
    data: Buffer | Readable,
    _contentType: string,
    _contentLength?: bigint
  ): Promise<void> {
    const fullPath = this.requirePath(path);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf(sep));
    await fs.mkdir(dirPath, { recursive: true });

    if (data instanceof Buffer) {
      await fs.writeFile(fullPath, data);
      return;
    }

    const writeStream = createWriteStream(fullPath);
    await new Promise<void>((resolve, reject) => {
      (data as Readable).pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}
