export function generateCacheKey(parts: Array<string | number>, params?: Record<string, unknown>): string {
  const base = parts.map(String).join(':');

  if (!params || Object.keys(params).length === 0) {
    return base;
  }

  const serializedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');

  return `${base}:${serializedParams}`;
}
