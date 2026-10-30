import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import {
  AccountStatus,
  generateId,
  IdType,
  ApiErrorCode,
  apiErrorOutputSchema,
  loginOutputSchema,
  emailRegisterInputSchema,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import { SelectAccount } from '@colanode/server/data/schema';
import {
  buildLoginSuccessOutput,
  buildLoginVerifyOutput,
  generatePasswordHash,
  hasAccounts,
} from '@colanode/server/lib/accounts';
import { config } from '@colanode/server/lib/config';
import { isAuthEmailRateLimited } from '@colanode/server/lib/rate-limits';

export const emailRegisterRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/email/register',
    schema: {
      body: emailRegisterInputSchema,
      response: {
        200: loginOutputSchema,
        400: apiErrorOutputSchema,
        403: apiErrorOutputSchema,
        429: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const input = request.body;
      const email = input.email.toLowerCase();

      const isEmailRateLimited = await isAuthEmailRateLimited(email);
      if (isEmailRateLimited) {
        return reply.code(429).send({
          code: ApiErrorCode.TooManyRequests,
          message: 'Too many authentication attempts. Please try again later.',
        });
      }

      const existingAccount = await database
        .selectFrom('accounts')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();

      if (config.account.verificationType === 'manual') {
        if (!existingAccount && (await hasAccounts())) {
          return reply.code(403).send({
            code: ApiErrorCode.AccountInvitationRequired,
            message:
              'Registration is by invitation only. Ask a workspace admin to invite you.',
          });
        }

        // Setting a password here would not prove who owns the invited email.
        if (
          existingAccount?.status === AccountStatus.Pending &&
          config.email.enabled
        ) {
          return reply.code(403).send({
            code: ApiErrorCode.AccountInvitationRequired,
            message:
              'You have been invited. Use "Forgot password" with this email to activate your account.',
          });
        }
      }

      const password = await generatePasswordHash(input.password);

      let account: SelectAccount | null | undefined = null;

      const status =
        config.account.verificationType === 'email'
          ? AccountStatus.Unverified
          : AccountStatus.Active;

      if (existingAccount) {
        if (existingAccount.status !== AccountStatus.Pending) {
          return reply.code(400).send({
            code: ApiErrorCode.EmailAlreadyExists,
            message: 'Email already exists. Login or use another email.',
          });
        }

        account = await database
          .updateTable('accounts')
          .set({
            password: password,
            name: input.name,
            updated_at: new Date(),
            status: status,
          })
          .where('id', '=', existingAccount.id)
          .returningAll()
          .executeTakeFirst();
      } else {
        account = await database
          .insertInto('accounts')
          .values({
            id: generateId(IdType.Account),
            name: input.name,
            email: email,
            password: password,
            status: status,
            created_at: new Date(),
          })
          .returningAll()
          .executeTakeFirst();
      }

      if (!account) {
        return reply.code(400).send({
          code: ApiErrorCode.AccountCreationFailed,
          message: 'Failed to create account.',
        });
      }

      if (account.status === AccountStatus.Unverified) {
        if (config.account.verificationType === 'email') {
          const output = await buildLoginVerifyOutput(account);
          return output;
        }

        return reply.code(400).send({
          code: ApiErrorCode.AccountPendingVerification,
          message:
            'Account is not verified yet. Contact your administrator to verify your account.',
        });
      }

      const output = await buildLoginSuccessOutput(account, request.client);
      return output;
    },
  });

  done();
};
