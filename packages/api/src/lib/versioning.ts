import { FastifyReply, FastifyRequest } from 'fastify';

import { ApiErrorCode } from '@colanode/core';

export const DEFAULT_API_VERSION = '1';

type VersionedHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => unknown;

/**
 * Runs the handler matching the `?version=` query parameter (defaults to
 * DEFAULT_API_VERSION) or replies 400 when the version is unknown. Returns
 * `any` so typed zod routes accept both their payload and a reply.
 */
export const dispatchVersion = (
  request: FastifyRequest,
  reply: FastifyReply,
  handlers: Record<string, () => unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  const query = request.query as { version?: string } | undefined;
  const version = query?.version ?? DEFAULT_API_VERSION;
  const handler = handlers[version];

  if (!handler) {
    return reply.code(400).send({
      code: ApiErrorCode.UnsupportedApiVersion,
      message: `Unsupported api version "${version}".`,
    });
  }

  return handler();
};

export const withVersion = (
  handlers: Record<string, VersionedHandler>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchVersion(
      request,
      reply,
      Object.fromEntries(
        Object.entries(handlers).map(([version, handler]) => [
          version,
          () => handler(request, reply),
        ])
      )
    );
  };
};
