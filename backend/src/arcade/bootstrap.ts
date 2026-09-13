import { GATEWAY_DB, knowledgeDbName } from './config';
import { command, listDatabases, serverCommand } from './client';

async function ignoreExists(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (
      msg.includes('already exists') ||
      msg.includes('already exist') ||
      msg.includes('duplicate') ||
      msg.includes('found')
    ) {
      return;
    }
    throw err;
  }
}

async function ensureDatabase(name: string): Promise<void> {
  const dbs = await listDatabases();
  const lower = dbs.map((d) => d.toLowerCase());
  if (lower.includes(name.toLowerCase())) return;
  await ignoreExists(() => serverCommand(`create database ${name}`));
}

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, '')}\``;
}

function createPropertySql(type: string, prop: string): string {
  const space = prop.indexOf(' ');
  const name = space === -1 ? prop : prop.slice(0, space);
  const typeSpec = space === -1 ? '' : prop.slice(space + 1);
  return `CREATE PROPERTY ${type}.${quoteIdent(name)} ${typeSpec}`.trimEnd();
}

async function ddl(db: string, sql: string): Promise<void> {
  await ignoreExists(() => command(db, sql));
}

const GATEWAY_TYPES: Array<{ type: string; props: string[] }> = [
  {
    type: 'User',
    props: [
      'id STRING',
      'username STRING',
      'password STRING',
      'email STRING',
      'displayName STRING',
      'createdAt STRING',
      'updatedAt STRING',
      'isActive BOOLEAN',
    ],
  },
  {
    type: 'ApiToken',
    props: [
      'id STRING',
      'userId STRING',
      'tokenName STRING',
      'tokenValue STRING',
      'tokenPrefix STRING',
      'isActive BOOLEAN',
      'lastUsedAt STRING',
      'createdAt STRING',
      'expiresAt STRING',
    ],
  },
  {
    type: 'Endpoint',
    props: [
      'id STRING',
      'userId STRING',
      'routeName STRING',
      'route STRING',
      'rateLimit INTEGER',
      'rateLimitWindowMs INTEGER',
      'allowedOrigins LIST',
      'description STRING',
      'isActive BOOLEAN',
      'topicFilterJson STRING',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
  {
    type: 'EndpointApiToken',
    props: ['id STRING', 'endpointId STRING', 'apiTokenId STRING', 'createdAt STRING'],
  },
  {
    type: 'EndpointSchema',
    props: ['id STRING', 'endpointId STRING', 'schemaId STRING', 'order INTEGER', 'createdAt STRING'],
  },
  {
    type: 'SchemaDoc',
    props: [
      'id STRING',
      'userId STRING',
      'name STRING',
      'description STRING',
      'content STRING',
      'systemPrompt STRING',
      'version INTEGER',
      'isPublished BOOLEAN',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
  {
    type: 'CallLog',
    props: [
      'id STRING',
      'endpointId STRING',
      'apiTokenId STRING',
      'method STRING',
      'path STRING',
      'status INTEGER',
      'requestBody STRING',
      'responseBody STRING',
      'responseTime INTEGER',
      'ipAddress STRING',
      'userAgent STRING',
      'errorMessage STRING',
      'createdAt STRING',
    ],
  },
  {
    type: 'ScrapeSource',
    props: [
      'id STRING',
      'userId STRING',
      'schemaId STRING',
      'name STRING',
      'seedUrl STRING',
      'allowedDomains LIST',
      'maxDepth INTEGER',
      'maxPages INTEGER',
      'isActive BOOLEAN',
      'status STRING',
      'lastCrawledAt STRING',
      'lastError STRING',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
  {
    type: 'ScrapeJob',
    props: [
      'id STRING',
      'sourceId STRING',
      'status STRING',
      'pagesCrawled INTEGER',
      'error STRING',
      'createdAt STRING',
      'updatedAt STRING',
      'completedAt STRING',
    ],
  },
  {
    type: 'CrmWebhook',
    props: [
      'id STRING',
      'endpointId STRING',
      'userId STRING',
      'name STRING',
      'url STRING',
      'method STRING',
      'headersJson STRING',
      'timeoutMs INTEGER',
      'enabled BOOLEAN',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
  {
    type: 'CrmPayloadSchema',
    props: [
      'id STRING',
      'endpointId STRING',
      'userId STRING',
      'jsonSchema STRING',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
  {
    type: 'AgentWorkflow',
    props: [
      'id STRING',
      'endpointId STRING',
      'userId STRING',
      'webhookId STRING',
      'name STRING',
      'triggerJson STRING',
      'stepsJson STRING',
      'confirmMessage STRING',
      'enabled BOOLEAN',
      'createdAt STRING',
      'updatedAt STRING',
    ],
  },
];

const GATEWAY_INDEXES = [
  'CREATE INDEX ON User (id) UNIQUE',
  'CREATE INDEX ON User (username) UNIQUE',
  'CREATE INDEX ON User (email) UNIQUE',
  'CREATE INDEX ON ApiToken (id) UNIQUE',
  'CREATE INDEX ON ApiToken (tokenValue) UNIQUE',
  'CREATE INDEX ON ApiToken (userId) NOTUNIQUE',
  'CREATE INDEX ON Endpoint (id) UNIQUE',
  'CREATE INDEX ON Endpoint (userId) NOTUNIQUE',
  'CREATE INDEX ON EndpointApiToken (endpointId) NOTUNIQUE',
  'CREATE INDEX ON EndpointSchema (endpointId) NOTUNIQUE',
  'CREATE INDEX ON SchemaDoc (id) UNIQUE',
  'CREATE INDEX ON SchemaDoc (userId) NOTUNIQUE',
  'CREATE INDEX ON CallLog (endpointId) NOTUNIQUE',
  'CREATE INDEX ON CallLog (apiTokenId) NOTUNIQUE',
  'CREATE INDEX ON ScrapeSource (id) UNIQUE',
  'CREATE INDEX ON ScrapeSource (userId) NOTUNIQUE',
  'CREATE INDEX ON ScrapeJob (sourceId) NOTUNIQUE',
  'CREATE INDEX ON CrmWebhook (endpointId) NOTUNIQUE',
  'CREATE INDEX ON CrmPayloadSchema (endpointId) NOTUNIQUE',
  'CREATE INDEX ON AgentWorkflow (endpointId) NOTUNIQUE',
];

export async function bootstrapGateway(): Promise<void> {
  await ensureDatabase(GATEWAY_DB);
  for (const spec of GATEWAY_TYPES) {
    await ddl(GATEWAY_DB, `CREATE DOCUMENT TYPE ${spec.type}`);
    for (const prop of spec.props) {
      await ddl(GATEWAY_DB, createPropertySql(spec.type, prop));
    }
  }
  for (const idx of GATEWAY_INDEXES) {
    await ddl(GATEWAY_DB, idx);
  }
}

const VERTEX_TYPES = [
  'Chunk',
  'Organization',
  'Program',
  'Location',
  'Schedule',
  'Contact',
  'WebPage',
  'ChunkRef',
];

const EDGE_TYPES = ['OFFERS', 'LOCATED_AT', 'HAS_SCHEDULE', 'HAS_CONTACT', 'MENTIONS'];

const bootstrappedKb = new Set<string>();

export async function bootstrapKnowledgeDb(userId: string): Promise<string> {
  const db = knowledgeDbName(userId);
  if (bootstrappedKb.has(db)) return db;
  await ensureDatabase(db);

  for (const type of VERTEX_TYPES) {
    await ddl(db, `CREATE VERTEX TYPE ${type}`);
  }
  for (const type of EDGE_TYPES) {
    await ddl(db, `CREATE EDGE TYPE ${type}`);
  }

  const chunkProps = [
    'id STRING',
    'content STRING',
    'originalReference STRING',
    'category STRING',
    'subcategory STRING',
    'schemaId STRING',
    'sourceId STRING',
    'sourceType STRING',
    'chunkIndex INTEGER',
    'schemaName STRING',
    'version INTEGER',
    'embedding LIST',
  ];
  for (const prop of chunkProps) {
    await ddl(db, createPropertySql('Chunk', prop));
  }

  const entityProps = ['key STRING', 'userId STRING', 'type STRING', 'name STRING', 'propsJson STRING'];
  for (const type of VERTEX_TYPES.filter((t) => t !== 'Chunk')) {
    for (const prop of entityProps) {
      await ddl(db, createPropertySql(type, prop));
    }
    await ddl(db, `CREATE INDEX ON ${type} (key) UNIQUE`);
  }

  await ddl(db, 'CREATE INDEX ON Chunk (id) UNIQUE');
  await ddl(db, 'CREATE INDEX ON Chunk (schemaId) NOTUNIQUE');
  await ddl(db, 'CREATE INDEX ON Chunk (sourceId) NOTUNIQUE');
  await ddl(db, 'CREATE INDEX ON Chunk (content) FULL_TEXT');
  await ddl(
    db,
    `CREATE INDEX ON Chunk (embedding) LSM_VECTOR METADATA {dimensions: 1536, similarity: 'COSINE', quantization: 'INT8'}`
  );

  bootstrappedKb.add(db);
  return db;
}

export async function bootstrapAll(): Promise<void> {
  await bootstrapGateway();
}
