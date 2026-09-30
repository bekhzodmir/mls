/**
 * Query-string helpers shared by the Radar and MLS modules. Workspace paths
 * come from `appPath` in `@/lib/routes`, which is icon-free like this file.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** The first non-empty value of a query parameter, trimmed. */
export function firstParam(params: SearchParamsRecord, key: string): string | undefined {
  const raw = params[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

/** Path plus a query string built from the non-empty entries, in the given order. */
export function withQuery(path: string, entries: [string, string | undefined][]): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) if (value) query.set(key, value);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
