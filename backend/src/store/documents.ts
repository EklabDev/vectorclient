import { GATEWAY_DB } from '../arcade/config';
import { command, query } from '../arcade/client';
import { buildSet, buildWhere, nowIso, Where } from '../arcade/sql';

export async function insertDoc<T extends Record<string, unknown>>(
  type: string,
  doc: Record<string, unknown>
): Promise<T> {
  const payload = { ...doc };
  if (!payload.createdAt) payload.createdAt = nowIso();
  const { sql, params } = buildSet(payload);
  await command(GATEWAY_DB, `INSERT INTO ${type} SET ${sql}`, params);
  const id = String(payload.id);
  const [row] = await findMany<T>(type, { id }, { limit: 1 });
  if (!row) throw new Error(`Failed to insert ${type}`);
  return row;
}

export async function findMany<T extends Record<string, unknown>>(
  type: string,
  where: Where = {},
  opts: { orderBy?: string; desc?: boolean; limit?: number; offset?: number } = {}
): Promise<T[]> {
  const { sql, params } = buildWhere(where);
  let statement = `SELECT FROM ${type} WHERE ${sql}`;
  if (opts.orderBy) {
    statement += ` ORDER BY ${opts.orderBy} ${opts.desc ? 'DESC' : 'ASC'}`;
  }
  if (opts.limit != null) statement += ` LIMIT ${Math.max(0, Math.floor(opts.limit))}`;
  if (opts.offset != null) statement += ` SKIP ${Math.max(0, Math.floor(opts.offset))}`;
  return query<T>(GATEWAY_DB, statement, params);
}

export async function findOne<T extends Record<string, unknown>>(
  type: string,
  where: Where
): Promise<T | null> {
  const rows = await findMany<T>(type, where, { limit: 1 });
  return rows[0] ?? null;
}

export async function updateById<T extends Record<string, unknown>>(
  type: string,
  id: string,
  fields: Record<string, unknown>
): Promise<T | null> {
  const { sql, params } = buildSet(fields);
  params.id = id;
  await command(GATEWAY_DB, `UPDATE ${type} SET ${sql} WHERE id = :id`, params);
  return findOne<T>(type, { id });
}

export async function deleteById(type: string, id: string): Promise<void> {
  await command(GATEWAY_DB, `DELETE FROM ${type} WHERE id = :id`, { id });
}

export async function deleteWhere(type: string, where: Where): Promise<void> {
  const { sql, params } = buildWhere(where);
  await command(GATEWAY_DB, `DELETE FROM ${type} WHERE ${sql}`, params);
}

export async function countDocs(type: string, where: Where = {}): Promise<number> {
  const { sql, params } = buildWhere(where);
  const rows = await query<{ count?: number; COUNT?: number }>(
    GATEWAY_DB,
    `SELECT count(*) as count FROM ${type} WHERE ${sql}`,
    params
  );
  const row = rows[0];
  return Number(row?.count ?? row?.COUNT ?? 0);
}
