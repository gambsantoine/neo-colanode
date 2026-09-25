import { FastifyReply } from 'fastify';
import { ApiErrorCode } from '@colanode/core';
import { ApiWriteResult } from './repository';

export const sendError = (
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string
) => {
  return reply.code(status).send({ code, message });
};

/** Handler for CRUD routes that are part of the contract but not built yet. */
export const notImplemented =
  (operation: string) => async (_: unknown, reply: FastifyReply) => {
    return sendError(
      reply,
      501,
      ApiErrorCode.NotImplemented,
      `${operation} is not implemented yet.`
    );
  };

type WriteResultOptions = {
  successStatus: number;
  failedCode: ApiErrorCode;
  notFoundCode: ApiErrorCode;
  resource: string;
};

export const sendWriteResult = <T>(
  reply: FastifyReply,
  result: ApiWriteResult<T> | { type: 'unsupported' },
  options: WriteResultOptions
) => {
  switch (result.type) {
    case 'success':
      return reply.code(options.successStatus).send({ data: result.data });
    case 'not_found':
      return sendError(
        reply,
        404,
        options.notFoundCode,
        `${options.resource} not found.`
      );
    case 'unsupported':
      return sendError(
        reply,
        400,
        ApiErrorCode.DocumentNotSupported,
        'This node type has no document.'
      );
    case 'forbidden':
      return sendError(
        reply,
        403,
        ApiErrorCode.Forbidden,
        'You do not have permission to perform this action.'
      );
    case 'conflict':
      return sendError(
        reply,
        409,
        ApiErrorCode.NodeAlreadyExists,
        result.message
      );
    case 'invalid':
      return sendError(
        reply,
        400,
        ApiErrorCode.ValidationError,
        result.message
      );
    case 'failed':
      return sendError(
        reply,
        500,
        options.failedCode,
        `Failed to save the ${options.resource.toLowerCase()}.`
      );
  }
};
