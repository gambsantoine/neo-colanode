import { describe, expect, it } from 'vitest';

import { isUniqueViolation } from '@colanode/server/lib/postgres-errors';

describe('isUniqueViolation', () => {
  it('recognizes unique violations, optionally on a given index', () => {
    const error = { code: '23505', constraint: 'accounts_username_unique' };
    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueViolation(error, 'accounts_username_unique')).toBe(true);
    expect(isUniqueViolation(error, 'other_index')).toBe(false);
  });

  it('ignores other errors and values', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });
});
