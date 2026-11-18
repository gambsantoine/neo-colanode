import { Migration } from 'kysely';

export const createWikiTables: Migration = {
  up: async (db) => {
    await db.schema
      .createTable('wiki_publications')
      .addColumn('wiki_id', 'varchar(30)', (col) => col.notNull().primaryKey())
      .addColumn('workspace_id', 'varchar(30)', (col) => col.notNull())
      .addColumn('slug', 'varchar(64)', (col) => col.notNull().unique())
      .addColumn('access', 'varchar(10)', (col) => col.notNull())
      .addColumn('home_node_id', 'varchar(30)')
      .addColumn('link_token_hash', 'varchar(100)')
      .addColumn('link_token_salt', 'varchar(100)')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull())
      .addColumn('created_by', 'varchar(30)', (col) => col.notNull())
      .addColumn('updated_at', 'timestamptz')
      .addColumn('updated_by', 'varchar(30)')
      .execute();

    await db.schema
      .createIndex('wiki_publications_workspace_id_idx')
      .on('wiki_publications')
      .column('workspace_id')
      .execute();

    // Readable paths of a published wiki. Paths that are no longer current
    // are kept so old links redirect to the node's new address.
    await db.schema
      .createTable('wiki_routes')
      .addColumn('wiki_id', 'varchar(30)', (col) => col.notNull())
      .addColumn('path', 'varchar(1000)', (col) => col.notNull())
      .addColumn('node_id', 'varchar(30)', (col) => col.notNull())
      .addColumn('is_current', 'boolean', (col) => col.notNull())
      .addColumn('created_at', 'timestamptz', (col) => col.notNull())
      .addPrimaryKeyConstraint('wiki_routes_pkey', ['wiki_id', 'path'])
      .execute();

    await db.schema
      .createIndex('wiki_routes_node_id_idx')
      .on('wiki_routes')
      .columns(['wiki_id', 'node_id'])
      .execute();
  },
  down: async (db) => {
    await db.schema.dropIndex('wiki_routes_node_id_idx').execute();
    await db.schema.dropTable('wiki_routes').execute();
    await db.schema.dropIndex('wiki_publications_workspace_id_idx').execute();
    await db.schema.dropTable('wiki_publications').execute();
  },
};
