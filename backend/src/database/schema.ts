import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: text('password').notNull(), // AES-256 encrypted
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

// API Tokens Table
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenName: varchar('token_name', { length: 255 }).notNull(),
    tokenValue: text('token_value').notNull().unique(), // Hashed
    tokenPrefix: varchar('token_prefix', { length: 12 }).notNull(), // e.g., "sk_test"
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => ({
    userIdIdx: index('api_tokens_user_id_idx').on(table.userId),
    tokenValueIdx: index('api_tokens_token_value_idx').on(table.tokenValue),
  })
);

// Endpoints Table
export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routeName: varchar('route_name', { length: 255 }).notNull(),
    route: varchar('route', { length: 255 }).notNull(), // e.g., "/webhook/payment"
    rateLimit: integer('rate_limit').notNull().default(100), // requests per window
    rateLimitWindowMs: integer('rate_limit_window_ms').notNull().default(60000),
    allowedOrigins: jsonb('allowed_origins').notNull().default(sql`'[]'::jsonb`), // CORS origins
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('endpoints_user_id_idx').on(table.userId),
    routeIdx: index('endpoints_route_idx').on(table.route),
    userRouteIdx: index('endpoints_user_route_idx').on(table.userId, table.route),
  })
);

// Endpoint-API Token Associations
export const endpointApiTokens = pgTable(
  'endpoint_api_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    apiTokenId: uuid('api_token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    endpointIdIdx: index('endpoint_api_tokens_endpoint_id_idx').on(table.endpointId),
    apiTokenIdIdx: index('endpoint_api_tokens_api_token_id_idx').on(table.apiTokenId),
    uniqueIdx: uniqueIndex('endpoint_api_tokens_unique_idx').on(table.endpointId, table.apiTokenId),
  })
);

// Forwarding Flows Table
export const forwardingFlows = pgTable(
  'forwarding_flows',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    order: integer('order').notNull(),
    flowType: varchar('flow_type', { length: 50 }).notNull(), // 'proxy', 'transform', 'condition', 'webhook'
    config: jsonb('config').notNull(), // Flow-specific config
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    endpointIdIdx: index('forwarding_flows_endpoint_id_idx').on(table.endpointId),
  })
);

// Schemas (Knowledge Base) Table
export const schemas = pgTable(
  'schemas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    content: text('content').notNull(), // Markdown content
    weaviateCollectionId: varchar('weaviate_collection_id', { length: 255 }).unique(),
    version: integer('version').notNull().default(1),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('schemas_user_id_idx').on(table.userId),
  })
);

// Endpoint-Schema Associations
export const endpointSchemas = pgTable(
  'endpoint_schemas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    schemaId: uuid('schema_id')
      .notNull()
      .references(() => schemas.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    endpointIdIdx: index('endpoint_schemas_endpoint_id_idx').on(table.endpointId),
    schemaIdIdx: index('endpoint_schemas_schema_id_idx').on(table.schemaId),
    uniqueIdx: uniqueIndex('endpoint_schemas_unique_idx').on(table.endpointId, table.schemaId),
  })
);

// Call Logs Table
export const callLogs = pgTable(
  'call_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    apiTokenId: uuid('api_token_id').references(() => apiTokens.id, { onDelete: 'set null' }),
    method: varchar('method', { length: 10 }).notNull(), // GET, POST, etc
    path: varchar('path', { length: 1024 }).notNull(),
    status: integer('status').notNull(),
    requestBody: text('request_body'), // First 10KB
    responseBody: text('response_body'), // First 10KB
    responseTime: integer('response_time').notNull(), // milliseconds
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    endpointIdCreatedIdx: index('call_logs_endpoint_id_created_idx').on(table.endpointId, table.createdAt),
    statusIdx: index('call_logs_status_idx').on(table.status),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiTokens: many(apiTokens),
  endpoints: many(endpoints),
  schemas: many(schemas),
}));

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  user: one(users, { fields: [endpoints.userId], references: [users.id] }),
  apiTokens: many(endpointApiTokens),
  forwardingFlows: many(forwardingFlows),
  schemas: many(endpointSchemas),
  callLogs: many(callLogs),
}));
