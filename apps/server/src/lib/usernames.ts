import { Kysely, Transaction } from 'kysely';

import { suggestUsername } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { DatabaseSchema } from '@colanode/server/data/schema';
import { isUniqueViolation } from '@colanode/server/lib/postgres-errors';

type Executor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export const isUsernameTaken = async (
  username: string,
  exceptAccountId: string | null = null,
  db: Executor = database
): Promise<boolean> => {
  const existing = await db
    .selectFrom('accounts')
    .select('id')
    .where('username', '=', username)
    .executeTakeFirst();

  return existing !== undefined && existing.id !== exceptAccountId;
};

// A free username derived from a name or an email: `ada`, then `ada2`...
// and a random suffix when the readable ones are all taken.
export const generateUniqueUsername = async (
  source: string,
  db: Executor = database
): Promise<string> => {
  const base = suggestUsername(source);

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    if (!(await isUsernameTaken(candidate, null, db))) {
      return candidate;
    }
  }

  return `${base}_${randomSuffix()}`;
};

export const USERNAME_UNIQUE_INDEX = 'accounts_username_unique';

export const isUsernameConflict = (error: unknown): boolean =>
  isUniqueViolation(error, USERNAME_UNIQUE_INDEX);

const randomSuffix = () =>
  Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

// Writes an account with a generated username. When another request takes
// the same username between the check and the write, retries with a random
// suffix instead of failing.
export const withGeneratedUsername = async <T>(
  source: string,
  write: (username: string) => Promise<T>
): Promise<T> => {
  let username = await generateUniqueUsername(source);

  for (let attempt = 0; ; attempt++) {
    try {
      return await write(username);
    } catch (error) {
      if (!isUsernameConflict(error) || attempt >= 2) {
        throw error;
      }

      username = `${suggestUsername(source)}_${randomSuffix()}`;
    }
  }
};
