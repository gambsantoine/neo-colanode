import { z } from 'zod/v4';

import { slugify } from '@colanode/core/lib/slugs';

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 32;

// Lowercase letters, digits, dots, dashes and underscores; starts and ends
// with a letter or a digit. Shown instead of the real name where it would be
// public, such as published wikis.
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export const normalizeUsername = (value: string): string =>
  value.trim().replace(/^@+/, '').toLowerCase();

export const isValidUsername = (value: string): boolean =>
  value.length >= MIN_USERNAME_LENGTH &&
  value.length <= MAX_USERNAME_LENGTH &&
  USERNAME_PATTERN.test(value);

export const usernameSchema = z
  .string({ error: 'Username is required' })
  .transform(normalizeUsername)
  .refine(isValidUsername, {
    message:
      'Use 3 to 32 lowercase letters, digits, dots, dashes or underscores.',
  });

// Readable starting point for a generated username: the name, or the part of
// the email before the @. Leaves room for a numeric suffix.
export const suggestUsername = (source: string): string => {
  const local = source.includes('@') ? source.split('@')[0]! : source;
  const base = slugify(local).replace(/-/g, '_').slice(0, 24);
  const trimmed = base.replace(/^[._-]+|[._-]+$/g, '');

  if (trimmed.length >= MIN_USERNAME_LENGTH) {
    return trimmed;
  }

  return `user${trimmed ? `_${trimmed}` : ''}`;
};
