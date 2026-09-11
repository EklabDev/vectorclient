export type WhereValue =
  | string
  | number
  | boolean
  | null
  | Date
  | { in: Array<string | number> }
  | { gte?: string | number | Date; lte?: string | number | Date };

export type Where = Record<string, WhereValue | undefined>;

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export function parseMaybeJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function buildWhere(where: Where): { sql: string; params: Record<string, unknown> } {
  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  let i = 0;
  for (const [key, raw] of Object.entries(where)) {
    if (raw === undefined) continue;
    if (raw !== null && typeof raw === 'object' && 'in' in raw) {
      const values = raw.in;
      if (values.length === 0) {
        parts.push('1 = 0');
        continue;
      }
      const names: string[] = [];
      for (const v of values) {
        const name = `w${i++}`;
        params[name] = v;
        names.push(`:${name}`);
      }
      parts.push(`${key} IN [${names.join(', ')}]`);
      continue;
    }
    if (raw !== null && typeof raw === 'object' && ('gte' in raw || 'lte' in raw) && !('in' in raw)) {
      const range = raw as { gte?: string | number | Date; lte?: string | number | Date };
      if (range.gte != null) {
        const name = `w${i++}`;
        params[name] = serializeValue(range.gte);
        parts.push(`${key} >= :${name}`);
      }
      if (range.lte != null) {
        const name = `w${i++}`;
        params[name] = serializeValue(range.lte);
        parts.push(`${key} <= :${name}`);
      }
      continue;
    }
    if (raw === null) {
      parts.push(`${key} IS NULL`);
      continue;
    }
    const name = `w${i++}`;
    params[name] = serializeValue(raw);
    parts.push(`${key} = :${name}`);
  }
  return { sql: parts.length ? parts.join(' AND ') : '1 = 1', params };
}

export function buildSet(fields: Record<string, unknown>): {
  sql: string;
  params: Record<string, unknown>;
} {
  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params[key] = serializeValue(value);
    parts.push(`${key} = :${key}`);
  }
  if (parts.length === 0) throw new Error('No fields to update');
  return { sql: parts.join(', '), params };
}
