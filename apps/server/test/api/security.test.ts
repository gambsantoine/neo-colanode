import { fastify } from 'fastify';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AccountStatus,
  ApiErrorCode,
  generateId,
  IdType,
  isSafeExternalUrl,
} from '@colanode/core';
import { clientDecorator } from '@colanode/server/api/client/plugins/client';
import { database } from '@colanode/server/data/database';
import { generateApiKeyToken } from '@colanode/server/lib/api-key-tokens';
import { apiRepository } from '@colanode/server/lib/api-repository';
import { config } from '@colanode/server/lib/config';
import { saveOtp } from '@colanode/server/lib/otps';
import { SocketConnection } from '@colanode/server/services/socket-connection';

import { buildTestApp } from '../helpers/app';
import {
  buildAuthHeader,
  createAccount,
  createDevice,
  createFileNode,
  createSpaceNode,
  createUser,
  createWorkspace,
} from '../helpers/seed';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const createApiKey = async (accountId: string) => {
  const apiKeyId = generateId(IdType.ApiKey);
  const { token, salt, hash } = generateApiKeyToken(apiKeyId);

  await database
    .insertInto('api_keys')
    .values({
      id: apiKeyId,
      account_id: accountId,
      workspace_id: null,
      name: 'test',
      token_hash: hash,
      token_salt: salt,
      created_at: new Date(),
    })
    .execute();

  return { apiKeyId, authorization: `Bearer ${token}` };
};

const createOtp = async (accountId: string, code = '123456') => {
  const id = generateId(IdType.OtpCode);
  await saveOtp(id, {
    id,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    otp: code,
    attributes: { accountId },
  });

  return id;
};

const resetPassword = (id: string, otp: string, password: string) =>
  app.inject({
    method: 'POST',
    url: '/client/v1/auth/email/password-reset/complete',
    payload: { id, otp, password },
  });

describe('file upload paths', () => {
  it('refuses an upload whose extension leaves the workspace directory', async () => {
    const account = await createAccount({ email: 'traversal@example.com' });
    const workspace = await createWorkspace({ createdBy: account.id });
    const user = await createUser({
      workspaceId: workspace.id,
      account,
      role: 'owner',
    });
    const { token } = await createDevice({ accountId: account.id });
    const rootId = await createSpaceNode({
      workspaceId: workspace.id,
      userId: user.id,
    });

    const fileId = await createFileNode({
      workspaceId: workspace.id,
      userId: user.id,
      parentId: rootId,
      rootId,
      size: 4,
      name: 'evil',
      extension: '/../../../../outside.txt',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/client/v1/workspaces/${workspace.id}/files/${fileId}/tus`,
      headers: {
        ...buildAuthHeader(token),
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '4',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.FileUploadFailed,
    });

    const upload = await database
      .selectFrom('uploads')
      .selectAll()
      .where('file_id', '=', fileId)
      .executeTakeFirst();

    expect(upload).toBeUndefined();
  });

  it('refuses an avatar id with path separators', async () => {
    const account = await createAccount({ email: 'avatar-id@example.com' });
    const { token } = await createDevice({ accountId: account.id });

    const response = await app.inject({
      method: 'GET',
      url: '/client/v1/avatars/..%2F..%2Fsecret',
      headers: buildAuthHeader(token),
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('external urls', () => {
  it.each([
    'https://example.com',
    'http://example.com/path?q=1',
    'mailto:someone@example.com',
    'tel:+33123456789',
  ])('allows %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'ms-msdt:/id',
    'not a url',
    '',
  ])('refuses %j', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});

describe('client ip', () => {
  const buildIpApp = () => {
    const instance = fastify({ trustProxy: config.trustProxy });
    instance.register(clientDecorator);
    instance.register(async (scope) => {
      scope.get('/ip', async (request) => ({ ip: request.client.ip }));
    });

    return instance;
  };

  it('ignores cf-connecting-ip unless it is configured', async () => {
    const instance = buildIpApp();

    const response = await instance.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '203.0.113.7',
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    });

    expect(response.json()).toEqual({ ip: '203.0.113.7' });
    await instance.close();
  });

  it('ignores x-forwarded-for from a client connecting directly', async () => {
    const instance = buildIpApp();

    const response = await instance.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '203.0.113.7',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    expect(response.json()).toEqual({ ip: '203.0.113.7' });
    await instance.close();
  });

  it('keeps the address seen by the proxy, not the one sent by the client', async () => {
    const instance = buildIpApp();

    const response = await instance.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '172.18.0.2',
      headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.9' },
    });

    expect(response.json()).toEqual({ ip: '198.51.100.9' });
    await instance.close();
  });
});

describe('otp attempts', () => {
  it('stops accepting the right code after too many parallel guesses', async () => {
    const account = await createAccount({ email: 'otp-race@example.com' });
    const id = await createOtp(account.id);

    await Promise.all(
      Array.from({ length: 8 }, () =>
        resetPassword(id, '000000', 'NewPassword123!')
      )
    );

    const response = await resetPassword(id, '123456', 'NewPassword123!');
    expect(response.statusCode).toBe(400);
  });
});

describe('password reset', () => {
  it('revokes the api keys and the devices of the account', async () => {
    const account = await createAccount({ email: 'reset-keys@example.com' });
    await createDevice({ accountId: account.id });
    const { apiKeyId, authorization } = await createApiKey(account.id);

    const before = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization },
    });
    expect(before.statusCode).toBe(200);

    const id = await createOtp(account.id);
    const response = await resetPassword(id, '123456', 'NewPassword123!');
    expect(response.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization },
    });
    expect(after.statusCode).toBe(401);

    const apiKey = await database
      .selectFrom('api_keys')
      .select(['revoked_at', 'revoked_by'])
      .where('id', '=', apiKeyId)
      .executeTakeFirstOrThrow();

    expect(apiKey.revoked_at).not.toBeNull();
    expect(apiKey.revoked_by).toBe(account.id);
  });

  it('does not activate an account waiting for an admin approval', async () => {
    const account = await createAccount({ email: 'reset-manual@example.com' });
    await database
      .updateTable('accounts')
      .set({ status: AccountStatus.Unverified })
      .where('id', '=', account.id)
      .execute();

    vi.spyOn(config.account, 'verificationType', 'get').mockReturnValue(
      'manual'
    );

    const id = await createOtp(account.id);
    const response = await resetPassword(id, '123456', 'NewPassword123!');
    expect(response.statusCode).toBe(200);

    const updated = await database
      .selectFrom('accounts')
      .select('status')
      .where('id', '=', account.id)
      .executeTakeFirstOrThrow();

    expect(updated.status).toBe(AccountStatus.Unverified);
  });

  it('refuses a weak password', async () => {
    const account = await createAccount({ email: 'reset-weak@example.com' });
    const id = await createOtp(account.id);

    const response = await resetPassword(id, '123456', 'short');
    expect(response.statusCode).toBe(400);
  });
});

describe('registration', () => {
  it('refuses a weak password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/v1/auth/email/register',
      payload: { name: 'Weak', email: 'weak@example.com', password: '1234' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('public api protections', () => {
  it('survives a failure of the last use update', async () => {
    const account = await createAccount({ email: 'api-touch@example.com' });
    const { authorization } = await createApiKey(account.id);

    vi.spyOn(apiRepository, 'touchApiKeyLastUsed').mockRejectedValue(
      new Error('database down')
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rate limits an api key', async () => {
    const account = await createAccount({ email: 'api-limit@example.com' });
    const { authorization } = await createApiKey(account.id);

    vi.spyOn(apiRepository, 'isApiKeyRateLimited').mockResolvedValue(true);

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.TooManyRequests,
    });
  });
});

describe('socket synchronizers', () => {
  it.each(['node.reactions', 'node.interactions'])(
    'refuses %s on a root the user cannot access',
    (type) => {
      const build = (rootId: string) =>
        (
          SocketConnection.prototype as unknown as {
            buildSynchronizer(message: unknown, user: unknown): unknown;
          }
        ).buildSynchronizer(
          { id: 'sync', cursor: '0', input: { type, rootId } },
          {
            user: { userId: 'user', workspaceId: 'workspace' },
            rootIds: new Set(['allowed']),
          }
        );

      expect(build('forbidden')).toBeNull();
      expect(build('allowed')).not.toBeNull();
    }
  );
});
