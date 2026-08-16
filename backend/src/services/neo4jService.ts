import neo4j, { Driver, Session } from 'neo4j-driver';

export type GraphEntityType =
  | 'Organization'
  | 'Program'
  | 'Location'
  | 'Schedule'
  | 'Contact'
  | 'WebPage'
  | 'ChunkRef';

export type GraphRelType =
  | 'OFFERS'
  | 'LOCATED_AT'
  | 'HAS_SCHEDULE'
  | 'HAS_CONTACT'
  | 'MENTIONS';

let driver: Driver | null = null;
let unavailable = false;

function getDriver(): Driver | null {
  if (unavailable) return null;
  if (driver) return driver;
  const uri = process.env.NEO4J_URI;
  if (!uri) {
    unavailable = true;
    return null;
  }
  const auth = process.env.NEO4J_AUTH || 'neo4j/password';
  const [user, ...rest] = auth.split('/');
  const password = rest.join('/') || 'password';
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    return driver;
  } catch (err) {
    console.error('Neo4j init failed:', err);
    unavailable = true;
    return null;
  }
}

async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
  const d = getDriver();
  if (!d) throw new Error('Neo4j is not configured (set NEO4J_URI)');
  const session = d.session();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

function entityKey(userId: string, type: string, name: string): string {
  return `${userId}:${type}:${name.trim().toLowerCase()}`;
}

export class Neo4jService {
  static isEnabled(): boolean {
    return !!getDriver();
  }

  static async upsertEntity(
    userId: string,
    type: GraphEntityType,
    name: string,
    props: Record<string, unknown> = {}
  ): Promise<{ key: string; type: string; name: string }> {
    const key = entityKey(userId, type, name);
    await withSession(async (session) => {
      await session.run(
        `
        MERGE (n:Entity {key: $key})
        SET n.userId = $userId,
            n.type = $type,
            n.name = $name,
            n.updatedAt = datetime(),
            n += $props
        ON CREATE SET n.createdAt = datetime()
        `,
        { key, userId, type, name: name.trim(), props }
      );
    });
    return { key, type, name: name.trim() };
  }

  static async upsertRel(
    userId: string,
    fromType: GraphEntityType,
    fromName: string,
    relType: GraphRelType,
    toType: GraphEntityType,
    toName: string,
    props: Record<string, unknown> = {}
  ): Promise<void> {
    const fromKey = entityKey(userId, fromType, fromName);
    const toKey = entityKey(userId, toType, toName);
    // Relationship type is from a fixed allowlist — never interpolated from user/model input
    const allowed: GraphRelType[] = [
      'OFFERS',
      'LOCATED_AT',
      'HAS_SCHEDULE',
      'HAS_CONTACT',
      'MENTIONS',
    ];
    if (!allowed.includes(relType)) throw new Error(`Invalid relationship type: ${relType}`);

    await withSession(async (session) => {
      await session.run(
        `
        MATCH (a:Entity {key: $fromKey, userId: $userId})
        MATCH (b:Entity {key: $toKey, userId: $userId})
        MERGE (a)-[r:${relType}]->(b)
        SET r.updatedAt = datetime(), r += $props
        ON CREATE SET r.createdAt = datetime()
        `,
        { fromKey, toKey, userId, props }
      );
    });
  }

  static async getEntity(
    userId: string,
    type: GraphEntityType,
    name: string
  ): Promise<Record<string, unknown> | null> {
    const key = entityKey(userId, type, name);
    return withSession(async (session) => {
      const result = await session.run(
        `MATCH (n:Entity {key: $key, userId: $userId}) RETURN n LIMIT 1`,
        { key, userId }
      );
      const node = result.records[0]?.get('n');
      if (!node) return null;
      return { ...node.properties };
    });
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
    const allowed: GraphRelType[] = [
      'OFFERS',
      'LOCATED_AT',
      'HAS_SCHEDULE',
      'HAS_CONTACT',
      'MENTIONS',
    ];

    return withSession(async (session) => {
      let cypher: string;
      const params: Record<string, unknown> = { key, userId };

      if (relType) {
        if (!allowed.includes(relType)) throw new Error(`Invalid relationship type: ${relType}`);
        cypher = `
          MATCH (a:Entity {key: $key, userId: $userId})-[r:${relType}*1..${d}]-(b:Entity)
          WHERE b.userId = $userId
          RETURN DISTINCT b, type(r[0]) AS rel
          LIMIT 50
        `;
      } else {
        cypher = `
          MATCH (a:Entity {key: $key, userId: $userId})-[r*1..${d}]-(b:Entity)
          WHERE b.userId = $userId
          RETURN DISTINCT b, type(r[0]) AS rel
          LIMIT 50
        `;
      }

      const result = await session.run(cypher, params);
      return result.records.map((rec) => {
        const node = rec.get('b');
        return {
          ...(node?.properties || {}),
          relationship: rec.get('rel'),
        };
      });
    });
  }

  static async deleteUserGraph(userId: string): Promise<void> {
    await withSession(async (session) => {
      await session.run(`MATCH (n:Entity {userId: $userId}) DETACH DELETE n`, { userId });
    });
  }
}
