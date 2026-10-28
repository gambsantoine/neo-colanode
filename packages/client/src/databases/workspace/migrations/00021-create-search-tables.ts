import { Kysely, Migration, sql } from 'kysely';

import {
  DocumentContent,
  extractDocumentText,
  getNodeModel,
  NodeAttributes,
} from '@colanode/core';

const BATCH_SIZE = 500;

// The previous node_texts and document_texts tables were contentless FTS5
// tables: their id column always read back as NULL, so deletes and updates
// by id never matched and search results could not be mapped back to nodes.
// They are replaced by regular tables (upsertable by id) backed by external
// content FTS5 indexes kept in sync by triggers. Diacritics are removed so
// that "ete" matches "été".
export const createSearchTables: Migration = {
  up: async (db) => {
    await sql`DROP TABLE IF EXISTS node_texts`.execute(db);
    await sql`DROP TABLE IF EXISTS document_texts`.execute(db);

    await sql`
      CREATE TABLE node_texts (
        seq INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        name TEXT,
        attributes TEXT
      )
    `.execute(db);

    await sql`
      CREATE VIRTUAL TABLE node_texts_fts USING fts5(
        name,
        attributes,
        content = 'node_texts',
        content_rowid = 'seq',
        tokenize = 'unicode61 remove_diacritics 2'
      )
    `.execute(db);

    await sql`
      CREATE TRIGGER node_texts_after_insert AFTER INSERT ON node_texts BEGIN
        INSERT INTO node_texts_fts (rowid, name, attributes)
        VALUES (new.seq, new.name, new.attributes);
      END
    `.execute(db);

    await sql`
      CREATE TRIGGER node_texts_after_delete AFTER DELETE ON node_texts BEGIN
        INSERT INTO node_texts_fts (node_texts_fts, rowid, name, attributes)
        VALUES ('delete', old.seq, old.name, old.attributes);
      END
    `.execute(db);

    await sql`
      CREATE TRIGGER node_texts_after_update AFTER UPDATE ON node_texts BEGIN
        INSERT INTO node_texts_fts (node_texts_fts, rowid, name, attributes)
        VALUES ('delete', old.seq, old.name, old.attributes);
        INSERT INTO node_texts_fts (rowid, name, attributes)
        VALUES (new.seq, new.name, new.attributes);
      END
    `.execute(db);

    await sql`
      CREATE TABLE document_texts (
        seq INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        text TEXT
      )
    `.execute(db);

    await sql`
      CREATE VIRTUAL TABLE document_texts_fts USING fts5(
        text,
        content = 'document_texts',
        content_rowid = 'seq',
        tokenize = 'unicode61 remove_diacritics 2'
      )
    `.execute(db);

    await sql`
      CREATE TRIGGER document_texts_after_insert AFTER INSERT ON document_texts BEGIN
        INSERT INTO document_texts_fts (rowid, text) VALUES (new.seq, new.text);
      END
    `.execute(db);

    await sql`
      CREATE TRIGGER document_texts_after_delete AFTER DELETE ON document_texts BEGIN
        INSERT INTO document_texts_fts (document_texts_fts, rowid, text)
        VALUES ('delete', old.seq, old.text);
      END
    `.execute(db);

    await sql`
      CREATE TRIGGER document_texts_after_update AFTER UPDATE ON document_texts BEGIN
        INSERT INTO document_texts_fts (document_texts_fts, rowid, text)
        VALUES ('delete', old.seq, old.text);
        INSERT INTO document_texts_fts (rowid, text) VALUES (new.seq, new.text);
      END
    `.execute(db);

    await backfillNodeTexts(db);
    await backfillDocumentTexts(db);
  },
  down: async (db) => {
    await sql`DROP TABLE IF EXISTS node_texts_fts`.execute(db);
    await sql`DROP TABLE IF EXISTS node_texts`.execute(db);
    await sql`DROP TABLE IF EXISTS document_texts_fts`.execute(db);
    await sql`DROP TABLE IF EXISTS document_texts`.execute(db);

    await sql`
      CREATE VIRTUAL TABLE node_texts USING fts5(id UNINDEXED, name, attributes, content='', contentless_delete=1);
    `.execute(db);
    await sql`
      CREATE VIRTUAL TABLE document_texts USING fts5(id UNINDEXED, text, content='', contentless_delete=1);
    `.execute(db);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const backfillNodeTexts = async (db: Kysely<any>) => {
  let lastId = '';
  for (;;) {
    const rows: { id: string; attributes: string }[] = await db
      .selectFrom('nodes')
      .select(['id', 'attributes'])
      .where('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE)
      .execute();

    if (rows.length === 0) {
      return;
    }

    lastId = rows[rows.length - 1]!.id;

    const values = [];
    for (const row of rows) {
      try {
        const attributes = JSON.parse(row.attributes) as NodeAttributes;
        const nodeText = getNodeModel(attributes.type)?.extractText(
          row.id,
          attributes
        );

        if (nodeText) {
          values.push({
            id: row.id,
            name: nodeText.name,
            attributes: nodeText.attributes,
          });
        }
      } catch {
        // A node that cannot be parsed is simply left out of the index.
      }
    }

    if (values.length > 0) {
      await db.insertInto('node_texts').values(values).execute();
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const backfillDocumentTexts = async (db: Kysely<any>) => {
  let lastId = '';
  for (;;) {
    const rows: { id: string; content: string }[] = await db
      .selectFrom('documents')
      .select(['id', 'content'])
      .where('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE)
      .execute();

    if (rows.length === 0) {
      return;
    }

    lastId = rows[rows.length - 1]!.id;

    const values = [];
    for (const row of rows) {
      try {
        const content = JSON.parse(row.content) as DocumentContent;
        values.push({ id: row.id, text: extractDocumentText(row.id, content) });
      } catch {
        // A document that cannot be parsed is simply left out of the index.
      }
    }

    if (values.length > 0) {
      await db.insertInto('document_texts').values(values).execute();
    }
  }
};
