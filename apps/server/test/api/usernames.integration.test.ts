import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateId, IdType } from '@colanode/core';
import { database } from '@colanode/server/data/database';

import { buildTestApp } from '../helpers/app';

// Registration with a username, on a real database (unique index included).
const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const uniqueEmail = () =>
  `user-${generateId(IdType.Account).slice(14, 26)}@example.com`;

const register = (payload: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: '/client/v1/auth/email/register',
    payload: { password: 'correct-horse-battery', ...payload },
  });

const usernameOf = async (email: string) => {
  const account = await database
    .selectFrom('accounts')
    .select('username')
    .where('email', '=', email)
    .executeTakeFirst();
  return account?.username ?? null;
};

describe('account usernames (real database)', () => {
  it('stores the chosen username, normalized', async () => {
    const email = uniqueEmail();
    const username = `Ada.${generateId(IdType.Account).slice(16, 24)}`;
    const response = await register({ name: 'Ada', email, username });

    expect(response.statusCode).toBe(200);
    expect(response.json().account.username).toBe(username.toLowerCase());
    expect(await usernameOf(email)).toBe(username.toLowerCase());
  });

  it('refuses a username already taken', async () => {
    const username = `taken_${generateId(IdType.Account).slice(16, 24)}`;
    await register({ name: 'First', email: uniqueEmail(), username });

    const second = await register({
      name: 'Second',
      email: uniqueEmail(),
      username,
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().code).toBe('username_taken');
  });

  it('refuses an invalid username', async () => {
    const response = await register({
      name: 'Bad',
      email: uniqueEmail(),
      username: 'a b',
    });
    expect(response.statusCode).toBe(400);
  });

  it('generates a username when an older client sends none', async () => {
    const email = uniqueEmail();
    const response = await register({ name: 'Grace Hopper', email });

    expect(response.statusCode).toBe(200);
    expect(await usernameOf(email)).toMatch(/^grace_hopper\d*$/);
  });
});
