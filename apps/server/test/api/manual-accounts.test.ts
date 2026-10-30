import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AccountStatus,
  ApiErrorCode,
  generateId,
  IdType,
} from '@colanode/core';
import { database } from '@colanode/server/data/database';
import * as accounts from '@colanode/server/lib/accounts';
import { config } from '@colanode/server/lib/config';
import { saveOtp } from '@colanode/server/lib/otps';
import { emailService } from '@colanode/server/services/email-service';
import { jobService } from '@colanode/server/services/job-service';

import { buildTestApp } from '../helpers/app';
import {
  buildAuthHeader,
  createAccount,
  createDevice,
  createUser,
  createWorkspace,
} from '../helpers/seed';

const app = buildTestApp();
const initialType = config.account.verificationType;
const initialEmail = config.email;

beforeAll(async () => {
  await app.ready();
  config.account.verificationType = 'manual';
});

afterEach(() => {
  vi.restoreAllMocks();
  config.email = initialEmail;
});

afterAll(async () => {
  config.account.verificationType = initialType;
  await app.close();
});

const PASSWORD = 'Password123!';

const register = (email: string) =>
  app.inject({
    method: 'POST',
    url: '/client/v1/auth/email/register',
    payload: { name: 'New user', email, password: PASSWORD },
  });

const accountByEmail = (email: string) =>
  database
    .selectFrom('accounts')
    .selectAll()
    .where('email', '=', email)
    .executeTakeFirst();

const invite = async (adminEmail: string, email: string) => {
  const admin = await createAccount({ email: adminEmail });
  const workspace = await createWorkspace({ createdBy: admin.id });
  await createUser({
    workspaceId: workspace.id,
    account: admin,
    role: 'owner',
  });
  const { token } = await createDevice({ accountId: admin.id });

  vi.spyOn(jobService, 'addJob').mockResolvedValue(undefined);

  return app.inject({
    method: 'POST',
    url: `/client/v1/workspaces/${workspace.id}/users`,
    headers: buildAuthHeader(token),
    payload: { users: [{ email, role: 'collaborator' }] },
  });
};

const enableEmail = () => {
  config.email = { ...initialEmail, enabled: true } as typeof config.email;
};

describe('invitation email', () => {
  const sentEmail = async (email: string) => {
    const user = await database
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();

    const send = vi.spyOn(emailService, 'sendEmail').mockResolvedValue();
    await accounts.sendWorkspaceInvitationEmail(user.id);

    return send.mock.calls[0]?.[0];
  };

  afterEach(() => {
    config.web = undefined;
  });

  it('is queued when an account is created by an invitation', async () => {
    await invite('owner-d@example.com', 'invited-d@example.com');

    expect(jobService.addJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.workspace.invitation.send' })
    );
  });

  it('explains how to activate a new account', async () => {
    await invite('owner-e@example.com', 'invited-e@example.com');
    enableEmail();
    config.web = { domain: 'app.example.com', protocol: 'https' };

    const email = await sentEmail('invited-e@example.com');

    expect(email?.to).toBe('invited-e@example.com');
    expect(email?.html).toContain('Forgot password?');
    expect(email?.html).toContain('https://app.example.com');
  });

  it('does not ask an existing account to activate', async () => {
    await createAccount({ email: 'member-f@example.com' });
    await invite('owner-f@example.com', 'member-f@example.com');
    enableEmail();
    config.web = { domain: 'app.example.com', protocol: 'https' };

    const email = await sentEmail('member-f@example.com');

    expect(email?.html).not.toContain('Forgot password?');
  });
});

describe('registration of manual accounts', () => {
  it('refuses someone who was not invited and creates no account', async () => {
    await createAccount({ email: 'existing@example.com' });

    const response = await register('stranger@example.com');

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: ApiErrorCode.AccountInvitationRequired,
    });
    expect(await accountByEmail('stranger@example.com')).toBeUndefined();
  });

  it('lets the first account of the server register', async () => {
    vi.spyOn(accounts, 'hasAccounts').mockResolvedValue(false);

    const response = await register('first@example.com');

    expect(response.statusCode).toBe(200);
    const account = await accountByEmail('first@example.com');
    expect(account?.status).toBe(AccountStatus.Active);
  });

  it('activates an invited account when email is disabled', async () => {
    const response = await invite(
      'owner-a@example.com',
      'Invited-A@Example.com'
    );
    expect(response.statusCode).toBe(200);

    const claim = await register('invited-a@example.com');

    expect(claim.statusCode).toBe(200);
    expect(claim.json()).toMatchObject({ type: 'success' });
    const account = await accountByEmail('invited-a@example.com');
    expect(account?.status).toBe(AccountStatus.Active);
  });

  it('requires a proof of the email when email is enabled', async () => {
    await invite('owner-b@example.com', 'invited-b@example.com');
    enableEmail();

    const claim = await register('invited-b@example.com');

    expect(claim.statusCode).toBe(403);
    const account = await accountByEmail('invited-b@example.com');
    expect(account?.status).toBe(AccountStatus.Pending);
    expect(account?.password).toBeNull();
  });
});

describe('activation through the password reset', () => {
  const reset = async (accountId: string) => {
    const id = generateId(IdType.OtpCode);
    await saveOtp(id, {
      id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      otp: '123456',
      attributes: { accountId },
    });

    return app.inject({
      method: 'POST',
      url: '/client/v1/auth/email/password-reset/complete',
      payload: { id, otp: '123456', password: PASSWORD },
    });
  };

  it('activates an invited account', async () => {
    await invite('owner-c@example.com', 'invited-c@example.com');
    const invited = await accountByEmail('invited-c@example.com');

    const response = await reset(invited!.id);

    expect(response.statusCode).toBe(200);
    const account = await accountByEmail('invited-c@example.com');
    expect(account?.status).toBe(AccountStatus.Active);
  });

  it('does not activate an account without an invitation', async () => {
    const account = await createAccount({
      email: 'legacy@example.com',
      status: AccountStatus.Unverified,
    });

    const response = await reset(account.id);

    expect(response.statusCode).toBe(200);
    const updated = await accountByEmail('legacy@example.com');
    expect(updated?.status).toBe(AccountStatus.Unverified);
  });
});

describe('other verification modes', () => {
  it('keeps open registration in automatic mode', async () => {
    config.account.verificationType = 'automatic';

    const response = await register('open@example.com');

    config.account.verificationType = 'manual';
    expect(response.statusCode).toBe(200);
  });
});
