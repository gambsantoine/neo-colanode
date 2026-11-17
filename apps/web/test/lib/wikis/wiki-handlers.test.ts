import { HTTPError } from 'ky';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WikiPublicationDeleteMutationHandler } from '@colanode/client/handlers/mutations/wikis/wiki-publication-delete';
import { WikiPublicationLinkCreateMutationHandler } from '@colanode/client/handlers/mutations/wikis/wiki-publication-link-create';
import { WikiPublicationUpdateMutationHandler } from '@colanode/client/handlers/mutations/wikis/wiki-publication-update';
import { WikiPublicationGetQueryHandler } from '@colanode/client/handlers/queries/wikis/wiki-publication-get';
import { WikiSlugAvailabilityQueryHandler } from '@colanode/client/handlers/queries/wikis/wiki-slug-availability';
import { MutationError, MutationErrorCode } from '@colanode/client/mutations';
import { QueryError, QueryErrorCode } from '@colanode/client/queries';
import { AppService } from '@colanode/client/services/app-service';
import { Event } from '@colanode/client/types/events';
import { WorkspaceStatus } from '@colanode/core';

type Method = 'get' | 'put' | 'post' | 'delete';

const publication = {
  wikiId: 'wiki1',
  slug: 'product-docs',
  access: 'public' as const,
  homeNodeId: null,
  url: 'https://colanode.test/wiki/product-docs',
  hasLink: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};

const buildHttpError = (status: number, body?: unknown) => {
  const response = new Response(
    body === undefined ? 'not json' : JSON.stringify(body),
    { status }
  );
  const request = new Request('https://colanode.test/api');
  return new HTTPError(response, request, {} as never);
};

const createClient = () => {
  const calls: { method: Method; url: string; options?: unknown }[] = [];
  let result: { data?: unknown; error?: unknown } = {};

  const handle = (method: Method) => (url: string, options?: unknown) => {
    calls.push({ method, url, options });
    return {
      json: async () => {
        if (result.error) {
          throw result.error;
        }
        return result.data;
      },
    };
  };

  return {
    calls,
    respond(data: unknown) {
      result = { data };
    },
    fail(error: unknown) {
      result = { error };
    },
    client: {
      get: vi.fn(handle('get')),
      put: vi.fn(handle('put')),
      post: vi.fn(handle('post')),
      delete: vi.fn(handle('delete')),
    },
  };
};

const createApp = (
  workspace: ReturnType<typeof createWorkspace> | null
): AppService =>
  ({
    getWorkspace: vi.fn(() => workspace),
  }) as unknown as AppService;

const createWorkspace = (
  client: ReturnType<typeof createClient>['client'],
  status: WorkspaceStatus = WorkspaceStatus.Active
) => ({
  workspaceId: 'ws1',
  status,
  account: { client },
});

const expectRejection = async (
  promise: Promise<unknown>,
  ErrorClass: typeof QueryError | typeof MutationError,
  code: string,
  message: string
) => {
  const error = await promise.then(
    () => null,
    (err: unknown) => err
  );
  expect(error).toBeInstanceOf(ErrorClass);
  expect((error as QueryError).code).toBe(code);
  expect((error as Error).message).toBe(message);
};

const event = { type: 'node.updated' } as unknown as Event;

describe('client/handlers/queries/wikis', () => {
  let fake: ReturnType<typeof createClient>;

  beforeEach(() => {
    fake = createClient();
  });

  describe('WikiPublicationGetQueryHandler', () => {
    const input = {
      type: 'wiki.publication.get' as const,
      userId: 'user1',
      wikiId: 'wiki1',
    };

    it('fetches the publication of the wiki', async () => {
      const app = createApp(createWorkspace(fake.client));
      fake.respond({ publication });

      const handler = new WikiPublicationGetQueryHandler(app);
      await expect(handler.handleQuery(input)).resolves.toEqual({
        publication,
      });

      expect(app.getWorkspace).toHaveBeenCalledWith('user1');
      expect(fake.calls).toEqual([
        {
          method: 'get',
          url: 'v1/workspaces/ws1/wikis/wiki1/publication',
          options: undefined,
        },
      ]);
    });

    it('throws when the workspace is missing', async () => {
      const handler = new WikiPublicationGetQueryHandler(createApp(null));
      await expectRejection(
        handler.handleQuery(input),
        QueryError,
        QueryErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
      expect(fake.calls).toHaveLength(0);
    });

    it('maps API errors with their message', async () => {
      fake.fail(
        buildHttpError(403, { code: 'forbidden', message: 'Not an admin' })
      );
      const handler = new WikiPublicationGetQueryHandler(
        createApp(createWorkspace(fake.client))
      );
      await expectRejection(
        handler.handleQuery(input),
        QueryError,
        QueryErrorCode.ApiError,
        'Not an admin'
      );
    });

    it('maps unknown errors', async () => {
      fake.fail(new Error('network down'));
      const handler = new WikiPublicationGetQueryHandler(
        createApp(createWorkspace(fake.client))
      );
      await expectRejection(
        handler.handleQuery(input),
        QueryError,
        QueryErrorCode.ApiError,
        'An unknown error occurred'
      );
    });

    it('never reports changes', async () => {
      const handler = new WikiPublicationGetQueryHandler(createApp(null));
      await expect(
        handler.checkForChanges(event, input, { publication })
      ).resolves.toEqual({ hasChanges: false });
    });
  });

  describe('WikiSlugAvailabilityQueryHandler', () => {
    const input = {
      type: 'wiki.slug.availability' as const,
      userId: 'user1',
      wikiId: 'wiki1',
      slug: 'product-docs',
    };

    it('checks the slug availability with search params', async () => {
      const output = { slug: 'product-docs', valid: true, available: true };
      fake.respond(output);
      const handler = new WikiSlugAvailabilityQueryHandler(
        createApp(createWorkspace(fake.client))
      );

      await expect(handler.handleQuery(input)).resolves.toEqual(output);
      expect(fake.calls).toEqual([
        {
          method: 'get',
          url: 'v1/workspaces/ws1/wikis/slug-availability',
          options: {
            searchParams: { slug: 'product-docs', wikiId: 'wiki1' },
          },
        },
      ]);
    });

    it('throws when the workspace is missing', async () => {
      const handler = new WikiSlugAvailabilityQueryHandler(createApp(null));
      await expectRejection(
        handler.handleQuery(input),
        QueryError,
        QueryErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
    });

    it('maps HTTP errors without a JSON body by status', async () => {
      fake.fail(buildHttpError(404));
      const handler = new WikiSlugAvailabilityQueryHandler(
        createApp(createWorkspace(fake.client))
      );
      await expectRejection(
        handler.handleQuery(input),
        QueryError,
        QueryErrorCode.ApiError,
        'Resource not found'
      );
    });

    it('never reports changes', async () => {
      const handler = new WikiSlugAvailabilityQueryHandler(createApp(null));
      await expect(
        handler.checkForChanges(event, input, {
          slug: 'product-docs',
          valid: true,
          available: false,
        })
      ).resolves.toEqual({ hasChanges: false });
    });
  });
});

describe('client/handlers/mutations/wikis', () => {
  let fake: ReturnType<typeof createClient>;

  beforeEach(() => {
    fake = createClient();
  });

  const handlerCases = [
    {
      name: 'WikiPublicationUpdateMutationHandler',
      create: (app: AppService) =>
        new WikiPublicationUpdateMutationHandler(app),
      input: {
        type: 'wiki.publication.update' as const,
        userId: 'user1',
        wikiId: 'wiki1',
        slug: 'product-docs',
        access: 'public' as const,
      },
    },
    {
      name: 'WikiPublicationDeleteMutationHandler',
      create: (app: AppService) =>
        new WikiPublicationDeleteMutationHandler(app),
      input: {
        type: 'wiki.publication.delete' as const,
        userId: 'user1',
        wikiId: 'wiki1',
      },
    },
    {
      name: 'WikiPublicationLinkCreateMutationHandler',
      create: (app: AppService) =>
        new WikiPublicationLinkCreateMutationHandler(app),
      input: {
        type: 'wiki.publication.link.create' as const,
        userId: 'user1',
        wikiId: 'wiki1',
      },
    },
  ];

  describe.each(handlerCases)('$name errors', ({ create, input }) => {
    const run = (app: AppService) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create(app).handleMutation(input as any);

    it('throws when the workspace is missing', async () => {
      await expectRejection(
        run(createApp(null)),
        MutationError,
        MutationErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
    });

    it('throws when the workspace is readonly', async () => {
      await expectRejection(
        run(createApp(createWorkspace(fake.client, WorkspaceStatus.Readonly))),
        MutationError,
        MutationErrorCode.WorkspaceReadonly,
        'Workspace is in readonly mode and you cannot make any changes.'
      );
      expect(fake.calls).toHaveLength(0);
    });

    it('maps API errors with their message', async () => {
      fake.fail(
        buildHttpError(409, { code: 'conflict', message: 'Slug already used' })
      );
      await expectRejection(
        run(createApp(createWorkspace(fake.client))),
        MutationError,
        MutationErrorCode.ApiError,
        'Slug already used'
      );
    });

    it('maps HTTP errors without a JSON body by status', async () => {
      fake.fail(buildHttpError(401));
      await expectRejection(
        run(createApp(createWorkspace(fake.client))),
        MutationError,
        MutationErrorCode.ApiError,
        'You are not authorized to perform this action'
      );
    });
  });

  describe('WikiPublicationUpdateMutationHandler', () => {
    it('puts the publication with a null home node by default', async () => {
      fake.respond(publication);
      const handler = new WikiPublicationUpdateMutationHandler(
        createApp(createWorkspace(fake.client))
      );

      await expect(
        handler.handleMutation({
          type: 'wiki.publication.update',
          userId: 'user1',
          wikiId: 'wiki1',
          slug: 'product-docs',
          access: 'public',
        })
      ).resolves.toEqual(publication);

      expect(fake.calls).toEqual([
        {
          method: 'put',
          url: 'v1/workspaces/ws1/wikis/wiki1/publication',
          options: {
            // No home page given: left out so the server keeps it.
            json: {
              slug: 'product-docs',
              access: 'public',
            },
          },
        },
      ]);
    });

    it('sends the home node when given', async () => {
      fake.respond({ ...publication, access: 'link', homeNodeId: 'page1' });
      const handler = new WikiPublicationUpdateMutationHandler(
        createApp(createWorkspace(fake.client))
      );

      await handler.handleMutation({
        type: 'wiki.publication.update',
        userId: 'user1',
        wikiId: 'wiki1',
        slug: 'docs',
        access: 'link',
        homeNodeId: 'page1',
      });

      expect(fake.calls[0]?.options).toEqual({
        json: { slug: 'docs', access: 'link', homeNodeId: 'page1' },
      });
    });
  });

  describe('WikiPublicationDeleteMutationHandler', () => {
    it('deletes the publication', async () => {
      fake.respond({ success: true });
      const handler = new WikiPublicationDeleteMutationHandler(
        createApp(createWorkspace(fake.client))
      );

      await expect(
        handler.handleMutation({
          type: 'wiki.publication.delete',
          userId: 'user1',
          wikiId: 'wiki1',
        })
      ).resolves.toEqual({ success: true });

      expect(fake.calls).toEqual([
        {
          method: 'delete',
          url: 'v1/workspaces/ws1/wikis/wiki1/publication',
          options: undefined,
        },
      ]);
    });
  });

  describe('WikiPublicationLinkCreateMutationHandler', () => {
    it('creates a new access link', async () => {
      fake.respond({ linkUrl: 'https://colanode.test/wiki/s/secret' });
      const handler = new WikiPublicationLinkCreateMutationHandler(
        createApp(createWorkspace(fake.client))
      );

      await expect(
        handler.handleMutation({
          type: 'wiki.publication.link.create',
          userId: 'user1',
          wikiId: 'wiki1',
        })
      ).resolves.toEqual({ linkUrl: 'https://colanode.test/wiki/s/secret' });

      expect(fake.calls).toEqual([
        {
          method: 'post',
          url: 'v1/workspaces/ws1/wikis/wiki1/publication/link',
          options: undefined,
        },
      ]);
    });
  });
});
