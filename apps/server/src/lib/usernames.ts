import { Kysely, Transaction } from 'kysely';

import { suggestUsername } from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { DatabaseSchema } from '@colanode/server/data/schema';

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

  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `${base}_${random}`;
};
