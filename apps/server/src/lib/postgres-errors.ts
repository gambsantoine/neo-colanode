// Postgres reports a broken unique index with the code 23505 and the name
// of the index or constraint.
export const isUniqueViolation = (
  error: unknown,
  constraint?: string
): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { code, constraint: name } = error as {
    code?: unknown;
    constraint?: unknown;
  };

  return code === '23505' && (!constraint || name === constraint);
};
