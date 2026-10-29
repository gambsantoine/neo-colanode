import { describe, expect, it } from 'vitest';

import {
  clampPasswordLength,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  getPasswordEntropy,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  secureRandomInt,
} from '@colanode/ui/lib/password-generator';

describe('lib/password-generator', () => {
  it('generates a password of the requested length', () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 32,
    });
    expect(password).toHaveLength(32);
  });

  it('includes at least one character of every enabled set', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword({
        ...DEFAULT_PASSWORD_OPTIONS,
        length: PASSWORD_MIN_LENGTH,
      });
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('only uses the enabled sets', () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 64,
      uppercase: false,
      symbols: false,
    });
    expect(password).toMatch(/^[a-z0-9]{64}$/);
  });

  it('leaves out ambiguous characters when asked', () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: PASSWORD_MAX_LENGTH,
      excludeAmbiguous: true,
    });
    expect(password).not.toMatch(/[0O1lI|`'"]/);
  });

  it('only uses the chosen symbols', () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 64,
      lowercase: false,
      uppercase: false,
      digits: false,
      symbolSet: '#! #',
    });
    expect(password).toMatch(/^[#!]{64}$/);
  });

  it('ignores symbols when the chosen set is empty', () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 32,
      symbolSet: '  ',
    });
    expect(password).toMatch(/^[a-zA-Z0-9]{32}$/);
  });

  it('returns an empty string when no set is enabled', () => {
    expect(
      generatePassword({
        ...DEFAULT_PASSWORD_OPTIONS,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
      })
    ).toBe('');
  });

  it('clamps the length', () => {
    expect(clampPasswordLength(1)).toBe(PASSWORD_MIN_LENGTH);
    expect(clampPasswordLength(1000)).toBe(PASSWORD_MAX_LENGTH);
    expect(clampPasswordLength(Number.NaN)).toBe(
      DEFAULT_PASSWORD_OPTIONS.length
    );
  });

  it('draws random integers within range', () => {
    for (let i = 0; i < 100; i++) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('rates strength from entropy', () => {
    expect(
      getPasswordStrength(
        getPasswordEntropy({ ...DEFAULT_PASSWORD_OPTIONS, length: 6 })
      )
    ).toBe('weak');
    expect(
      getPasswordStrength(getPasswordEntropy(DEFAULT_PASSWORD_OPTIONS))
    ).toBe('very-strong');
  });
});
