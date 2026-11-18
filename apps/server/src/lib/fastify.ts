import { FastifyRequest } from 'fastify';

import { config } from './config';

// Scheme, host and port the server is reached at, without the path prefix:
// the configured public address when there is one, otherwise the request.
export const generateOrigin = (request: FastifyRequest): string => {
  if (config.publicUrl) {
    return new URL(config.publicUrl).origin;
  }

  const port =
    request.port && request.port != 80 && request.port != 443
      ? `:${request.port}`
      : '';

  return `${request.protocol}://${request.hostname}${port}`;
};

export const generateUrl = (request: FastifyRequest, path: string) => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';
  return `${generateOrigin(request)}${prefix}${path}`;
};
