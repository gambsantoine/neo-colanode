import { Kysely, Migration, sql } from 'kysely';

import { suggestUsername } from '@colanode/core';

// Usernames are shown instead of real names on public pages. Existing
// accounts get one generated from their name or email.
export const addAccountUsernames: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .alterTable('accounts')
      .addColumn('username', 'varchar(32)')
      .execute();

    const accounts = await sql<{ id: string; name: string; email: string }>`
      select id, name, email from accounts order by created_at
    `.execute(db);

    const taken = new Set<string>();
    for (const account of accounts.rows) {
      const base = suggestUsername(account.name || account.email);
      let username = base;
      let counter = 2;
      while (taken.has(username)) {
        username = `${base}${counter}`;
        counter++;
      }

      taken.add(username);
      await sql`update accounts set username = ${username} where id = ${account.id}`.execute(
        db
      );
    }

    await db.schema
      .createIndex('accounts_username_unique')
      .on('accounts')
      .column('username')
      .unique()
      .execute();
  },
  down: async (db) => {
    await db.schema.dropIndex('accounts_username_unique').execute();
    await db.schema.alterTable('accounts').dropColumn('username').execute();
  },
};
