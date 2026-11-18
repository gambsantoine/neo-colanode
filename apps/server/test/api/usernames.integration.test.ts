import { randomUUID } from 'crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  `user-${randomUUID().replace(/-/g, '').slice(0, 10)}@example.com`;

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
    const username = `Ada.${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const response = await register({ name: 'Ada', email, username });

    expect(response.statusCode).toBe(200);
    expect(response.json().account.username).toBe(username.toLowerCase());
    expect(await usernameOf(email)).toBe(username.toLowerCase());
  });

  it('refuses a username already taken', async () => {
    const username = `taken_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
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

  it('never fails with 500 when two people take a username at once', async () => {
    const username = `race_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const responses = await Promise.all(
      [0, 1, 2].map((index) =>
        register({ name: `Racer ${index}`, email: uniqueEmail(), username })
      )
    );

    const codes = responses.map((response) => response.statusCode).sort();
    expect(codes.filter((code) => code === 200)).toHaveLength(1);
    expect(codes.filter((code) => code === 400)).toHaveLength(2);
  });
});
