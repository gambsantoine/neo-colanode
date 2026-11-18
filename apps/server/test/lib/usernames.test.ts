import { beforeEach, describe, expect, it, vi } from 'vitest';

const taken = vi.hoisted(() => new Set<string>());

vi.mock('@colanode/server/data/database', () => {
  const builder = {
    username: '',
    select() {
      return this;
    },
    where(_column: string, _op: string, value: string) {
      this.username = value;
      return this;
    },
    async executeTakeFirst() {
      return taken.has(this.username) ? { id: 'other' } : undefined;
    },
  };
  return { database: { selectFrom: () => ({ ...builder }) } };
});

const { generateUniqueUsername, isUsernameTaken, withGeneratedUsername } =
  await import('@colanode/server/lib/usernames');

const conflict = () =>
  Object.assign(new Error('duplicate'), {
    code: '23505',
    constraint: 'accounts_username_unique',
  });

describe('server usernames', () => {
  beforeEach(() => {
    taken.clear();
  });

  it('knows whether a username belongs to someone else', async () => {
    taken.add('ada');
    expect(await isUsernameTaken('ada')).toBe(true);
    expect(await isUsernameTaken('ada', 'other')).toBe(false);
    expect(await isUsernameTaken('bob')).toBe(false);
  });

  it('adds a number to a taken username', async () => {
    taken.add('ada_lovelace');
    taken.add('ada_lovelace2');
    expect(await generateUniqueUsername('Ada Lovelace')).toBe('ada_lovelace3');
  });

  it('falls back to a random suffix when readable ones are all taken', async () => {
    taken.add('ada');
    for (let index = 2; index <= 20; index++) {
      taken.add(`ada${index}`);
    }
    expect(await generateUniqueUsername('ada')).toMatch(/^ada_\d{6}$/);
  });

  it('retries the write when another request took the username', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce('saved');

    expect(await withGeneratedUsername('Ada', write)).toBe('saved');
    expect(write.mock.calls[0]![0]).toBe('ada');
    expect(write.mock.calls[1]![0]).toMatch(/^ada_\d{6}$/);
  });

  it('gives up after three conflicts and rethrows other errors', async () => {
    const always = vi.fn().mockRejectedValue(conflict());
    await expect(withGeneratedUsername('Ada', always)).rejects.toThrow(
      'duplicate'
    );
    expect(always).toHaveBeenCalledTimes(3);

    const broken = vi.fn().mockRejectedValue(new Error('down'));
    await expect(withGeneratedUsername('Ada', broken)).rejects.toThrow('down');
    expect(broken).toHaveBeenCalledTimes(1);
  });
});
