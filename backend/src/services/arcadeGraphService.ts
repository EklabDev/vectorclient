import { command, query } from '../arcade/client';
import { knowledgeDbName } from '../arcade/config';
import { parseMaybeJson } from '../arcade/sql';
import { bootstrapKnowledgeDb } from '../arcade/bootstrap';

export type GraphEntityType =
  | 'Organization'
  | 'Program'
  | 'Location'
  | 'Schedule'
  | 'Contact'
  | 'WebPage'
  | 'ChunkRef';

export type GraphRelType = 'OFFERS' | 'LOCATED_AT' | 'HAS_SCHEDULE' | 'HAS_CONTACT' | 'MENTIONS';

const VERTEX_TYPES = new Set<GraphEntityType>([
  'Organization',
  'Program',
  'Location',
  'Schedule',
  'Contact',
  'WebPage',
  'ChunkRef',
]);

const REL_TYPES = new Set<GraphRelType>(['OFFERS', 'LOCATED_AT', 'HAS_SCHEDULE', 'HAS_CONTACT', 'MENTIONS']);

function entityKey(userId: string, type: string, name: string): string {
  return `${userId}:${type}:${name.trim().toLowerCase()}`;
}

function db(userId: string): string {
  return knowledgeDbName(userId);
}

export class ArcadeGraphService {
  static async ensureDb(userId: string): Promise<void> {
    await bootstrapKnowledgeDb(userId);
  }

  static isEnabled(): boolean {
    return true;
  }

  static async upsertEntity(
    userId: string,
    type: GraphEntityType,
    name: string,
    props: Record<string, unknown> = {}
  ): Promise<{ key: string; type: string; name: string }> {
    if (!VERTEX_TYPES.has(type)) throw new Error(`Invalid entity type: ${type}`);
    await this.ensureDb(userId);
    const key = entityKey(userId, type, name);
    const existing = await query(db(userId), `SELECT FROM ${type} WHERE key = :key`, { key });
    const propsJson = JSON.stringify(props);
    if (existing[0]) {
      await command(db(userId), `UPDATE ${type} SET name = :name, propsJson = :propsJson WHERE key = :key`, {
        name: name.trim(),
        propsJson,
        key,
      });
    } else {
      await command(
        db(userId),
        `INSERT INTO ${type} SET key = :key, userId = :userId, type = :type, name = :name, propsJson = :propsJson`,
        { key, userId, type, name: name.trim(), propsJson }
      );
    }
    return { key, type, name: name.trim() };
  }

  static async upsertRel(
    userId: string,
    fromType: GraphEntityType,
    fromName: string,
    relType: GraphRelType,
    toType: GraphEntityType,
    toName: string
  ): Promise<void> {
    if (!REL_TYPES.has(relType)) throw new Error(`Invalid relationship type: ${relType}`);
    const fromKey = entityKey(userId, fromType, fromName);
    const toKey = entityKey(userId, toType, toName);
    await command(
      db(userId),
      `CREATE EDGE ${relType} FROM (SELECT FROM ${fromType} WHERE key = :fromKey) TO (SELECT FROM ${toType} WHERE key = :toKey)`,
      { fromKey, toKey },
      'sql'
    );
  }

  static async getEntity(
    userId: string,
    type: GraphEntityType,
    name: string
  ): Promise<Record<string, unknown> | null> {
    const key = entityKey(userId, type, name);
    const rows = await query<Record<string, unknown>>(db(userId), `SELECT FROM ${type} WHERE key = :key LIMIT 1`, {
      key,
    });
    const row = rows[0];
    if (!row) return null;
    return flattenEntity(row);
  }

  static async findRelated(
    userId: string,
    type: GraphEntityType,
    name: string,
    relType?: GraphRelType,
    depth: number = 1
  ): Promise<Array<Record<string, unknown>>> {
    const key = entityKey(userId, type, name);
    const d = Math.min(2, Math.max(1, Math.floor(depth)));
    let cypher: string;
    if (relType) {
      if (!REL_TYPES.has(relType)) throw new Error(`Invalid relationship type: ${relType}`);
      cypher = `MATCH (a {key: $key})-[r:${relType}*1..${d}]-(b) RETURN DISTINCT b, type(r[0]) AS rel LIMIT 50`;
    } else {
      cypher = `MATCH (a {key: $key})-[r*1..${d}]-(b) RETURN DISTINCT b, type(r[0]) AS rel LIMIT 50`;
    }
    const rows = await query<Record<string, unknown>>(db(userId), cypher, { key }, 'cypher');
    return rows.map((rec) => {
      const node = (rec.b || rec) as Record<string, unknown>;
      return { ...flattenEntity(node), relationship: rec.rel };
    });
  }
}

function flattenEntity(row: Record<string, unknown>): Record<string, unknown> {
  const props = parseMaybeJson<Record<string, unknown>>(row.propsJson, {});
  const { propsJson, '@rid': _rid, '@type': _type, ...rest } = row;
  return { ...rest, ...props };
}
