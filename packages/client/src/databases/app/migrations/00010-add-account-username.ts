import { Migration } from 'kysely';

export const addAccountUsername: Migration = {
  up: async (db) => {
    await db.schema
      .alterTable('accounts')
      .addColumn('username', 'text')
      .execute();
  },
  down: async (db) => {
    await db.schema.alterTable('accounts').dropColumn('username').execute();
  },
};
