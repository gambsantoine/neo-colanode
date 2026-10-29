export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  // Symbols used when `symbols` is enabled, chosen by the user.
  symbolSet: string;
  // Leaves out characters that are easy to mix up (0/O, 1/l/I...).
  excludeAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~';

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  symbolSet: DEFAULT_PASSWORD_SYMBOLS,
  excludeAmbiguous: false,
};

const CHARACTER_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
} as const;

const AMBIGUOUS_CHARACTERS = new Set('0O1lI|`\'"');

const uniqueCharacters = (value: string): string =>
  Array.from(new Set(Array.from(value))).join('');

// Keeps each symbol once and drops whitespace.
export const normalizePasswordSymbols = (value: string): string =>
  uniqueCharacters(value.replace(/\s/g, ''));

// Returns a uniform integer in [0, max) from the Web Crypto API, using
// rejection sampling to avoid modulo bias.
export const secureRandomInt = (max: number): number => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);

  return value % max;
};

export const clampPasswordLength = (length: number): number => {
  if (!Number.isFinite(length)) {
    return DEFAULT_PASSWORD_OPTIONS.length;
  }

  return Math.min(
    PASSWORD_MAX_LENGTH,
    Math.max(PASSWORD_MIN_LENGTH, Math.round(length))
  );
};

// Character sets enabled by the options, ambiguous characters removed.
export const getPasswordCharacterSets = (
  options: PasswordOptions
): string[] => {
  const sets: string[] = [];
  if (options.lowercase) sets.push(CHARACTER_SETS.lowercase);
  if (options.uppercase) sets.push(CHARACTER_SETS.uppercase);
  if (options.digits) sets.push(CHARACTER_SETS.digits);
  if (options.symbols) sets.push(normalizePasswordSymbols(options.symbolSet));

  return sets
    .map((set) =>
      Array.from(set)
        .filter(
          (char) => !options.excludeAmbiguous || !AMBIGUOUS_CHARACTERS.has(char)
        )
        .join('')
    )
    .filter((set) => set.length > 0);
};

// Every allowed character once, so a symbol that is also a letter or digit
// is not drawn more often.
const getPasswordPool = (sets: string[]): string =>
  uniqueCharacters(sets.join(''));

// Generates a password holding at least one character of every enabled set.
// Returns an empty string when no set is enabled.
export const generatePassword = (
  options: PasswordOptions,
  randomInt: (max: number) => number = secureRandomInt
): string => {
  const sets = getPasswordCharacterSets(options);
  if (sets.length === 0) {
    return '';
  }

  const length = Math.max(clampPasswordLength(options.length), sets.length);
  const pool = getPasswordPool(sets);

  const chars = sets.map((set) => set[randomInt(set.length)]!);
  while (chars.length < length) {
    chars.push(pool[randomInt(pool.length)]!);
  }

  // Fisher-Yates shuffle so the guaranteed characters are not at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join('');
};

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

// Entropy in bits of a password drawn uniformly from the enabled sets.
export const getPasswordEntropy = (options: PasswordOptions): number => {
  const poolSize = getPasswordPool(getPasswordCharacterSets(options)).length;
  if (poolSize === 0) {
    return 0;
  }

  return clampPasswordLength(options.length) * Math.log2(poolSize);
};

export const getPasswordStrength = (entropy: number): PasswordStrength => {
  if (entropy < 50) {
    return 'weak';
  }
  if (entropy < 80) {
    return 'fair';
  }
  if (entropy < 120) {
    return 'strong';
  }
  return 'very-strong';
};
