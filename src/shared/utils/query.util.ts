export type SortDirection = 'asc' | 'desc';

export function buildOrderBy<T extends string>(
  orderBy: string | undefined,
  direction: SortDirection | undefined,
  allowedFields: readonly T[],
  defaultOrderBy: Record<string, SortDirection>,
): Record<string, SortDirection> {
  if (!orderBy || !allowedFields.includes(orderBy as T)) {
    return defaultOrderBy;
  }

  return { [orderBy]: direction ?? 'desc' };
}

export function normalizeSearch(search?: string): string | undefined {
  const normalized = search?.trim();
  return normalized ? normalized : undefined;
}
