import { Kysely, Transaction } from 'kysely';

import { database } from '@colanode/server/data/database';
import { redis } from '@colanode/server/data/redis';
import { DatabaseSchema } from '@colanode/server/data/schema';
import { createLogger } from '@colanode/server/lib/logger';
import { forgetReadableWiki } from '@colanode/server/lib/wikis/readable';
import { wikiRoutesCacheKey } from '@colanode/server/lib/wikis/service';

const logger = createLogger('server:wiki:cleanup');

type Executor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

// Forgets the stored addresses of a wiki. Call `forgetWikiCaches` once the
// surrounding transaction is committed.
export const deleteWikiRoutes = async (wikiId: string, db: Executor) => {
  await db.deleteFrom('wiki_routes').where('wiki_id', '=', wikiId).execute();
};

export const forgetWikiCaches = async (wikiIds: string[]) => {
  for (const wikiId of wikiIds) {
    forgetReadableWiki(wikiId);
    try {
      await redis.del(wikiRoutesCacheKey(wikiId));
    } catch (error) {
      logger.warn(error, `Failed to forget the routes of wiki ${wikiId}`);
    }
  }
};

export const deleteWikiPublication = async (wikiId: string) => {
  await database.transaction().execute(async (trx) => {
    await deleteWikiRoutes(wikiId, trx);
    await trx
      .deleteFrom('wiki_publications')
      .where('wiki_id', '=', wikiId)
      .execute();
  });

  await forgetWikiCaches([wikiId]);
};

export const deleteWorkspaceWikiPublications = async (workspaceId: string) => {
  const wikiIds = await database.transaction().execute(async (trx) => {
    const publications = await trx
      .deleteFrom('wiki_publications')
      .where('workspace_id', '=', workspaceId)
      .returning('wiki_id')
      .execute();
    const ids = publications.map((publication) => publication.wiki_id);

    if (ids.length > 0) {
      await trx.deleteFrom('wiki_routes').where('wiki_id', 'in', ids).execute();
    }

    return ids;
  });

  await forgetWikiCaches(wikiIds);
};
