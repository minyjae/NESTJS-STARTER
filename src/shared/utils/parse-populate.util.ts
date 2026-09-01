export function parsePopulate(populate?: string, allowedFields: string[] = []): string[] {
  if (!populate) {
    return [];
  }

  const requestedFields = populate
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (allowedFields.length === 0) {
    return requestedFields;
  }

  return requestedFields.filter((field) => allowedFields.includes(field));
}
