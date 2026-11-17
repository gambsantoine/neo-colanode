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
import {
  isUsernameConflict,
  isUsernameTaken,
  withGeneratedUsername,
} from '@colanode/server/lib/usernames';

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

      if (
        input.username &&
        (await isUsernameTaken(input.username, existingAccount?.id ?? null))
      ) {
        return reply.code(400).send({
          code: ApiErrorCode.UsernameTaken,
          message: 'This username is already taken. Choose another one.',
        });
      }

      if (existingAccount && existingAccount.status !== AccountStatus.Pending) {
        return reply.code(400).send({
          code: ApiErrorCode.EmailAlreadyExists,
          message: 'Email already exists. Login or use another email.',
        });
      }

      const password = await generatePasswordHash(input.password);

      const status =
        config.account.verificationType === 'email'
          ? AccountStatus.Unverified
          : AccountStatus.Active;

      const writeAccount = (username: string) =>
        existingAccount
          ? database
              .updateTable('accounts')
              .set({
                password: password,
                name: input.name,
                username,
                updated_at: new Date(),
                status: status,
              })
              .where('id', '=', existingAccount.id)
              .returningAll()
              .executeTakeFirst()
          : database
              .insertInto('accounts')
              .values({
                id: generateId(IdType.Account),
                name: input.name,
                username,
                email: email,
                password: password,
                status: status,
                created_at: new Date(),
              })
              .returningAll()
              .executeTakeFirst();

      let account: SelectAccount | null | undefined = null;
      const chosenUsername = input.username ?? existingAccount?.username;
      if (chosenUsername) {
        try {
          account = await writeAccount(chosenUsername);
        } catch (error) {
          // Taken by another request between the check and the write.
          if (isUsernameConflict(error)) {
            return reply.code(400).send({
              code: ApiErrorCode.UsernameTaken,
              message: 'This username is already taken. Choose another one.',
            });
          }

          throw error;
        }
      } else {
        account = await withGeneratedUsername(
          input.name || email,
          writeAccount
        );
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
