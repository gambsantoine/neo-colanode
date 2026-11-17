import { database } from '@colanode/server/data/database';

export const deleteWikiPublication = async (wikiId: string) => {
  await database.transaction().execute(async (trx) => {
    await trx.deleteFrom('wiki_routes').where('wiki_id', '=', wikiId).execute();
    await trx
      .deleteFrom('wiki_publications')
      .where('wiki_id', '=', wikiId)
      .execute();
  });
};

export const deleteWorkspaceWikiPublications = async (workspaceId: string) => {
  await database.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('wiki_routes')
      .where('wiki_id', 'in', (eb) =>
        eb
          .selectFrom('wiki_publications')
          .select('wiki_id')
          .where('workspace_id', '=', workspaceId)
      )
      .execute();
    await trx
      .deleteFrom('wiki_publications')
      .where('workspace_id', '=', workspaceId)
      .execute();
  });
};
