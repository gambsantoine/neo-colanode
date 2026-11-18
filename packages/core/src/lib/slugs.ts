export const MAX_SLUG_LENGTH = 64;
export const MIN_WIKI_SLUG_LENGTH = 3;

// Slugs reserved by the public wiki routes (`/wiki/:slug/_files/...`) or that
// would be confusing as a wiki address.
export const RESERVED_WIKI_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'client',
  'config',
  'login',
  'new',
  's',
  'static',
  'wiki',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Turns a name into a readable, URL safe slug: "Premiers pas !" -> "premiers-pas".
export const slugify = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
};

export const isValidSlug = (value: string): boolean => {
  return (
    value.length > 0 &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
};

export const isValidWikiSlug = (value: string): boolean => {
  return (
    isValidSlug(value) &&
    value.length >= MIN_WIKI_SLUG_LENGTH &&
    !RESERVED_WIKI_SLUGS.has(value)
  );
};

// Returns `base`, or `base-2`, `base-3`... the first one not already taken.
export const uniqueSlug = (base: string, taken: Set<string>): string => {
  const root = base.length > 0 ? base : 'page';
  if (!taken.has(root)) {
    return root;
  }

  let counter = 2;
  while (taken.has(`${root}-${counter}`)) {
    counter++;
  }

  return `${root}-${counter}`;
};
