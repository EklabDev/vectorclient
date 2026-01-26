# Cursor Implementation Guide - API Gateway Platform

## Overview

This document provides Cursor with detailed implementation guidance, code patterns, and examples to build the API Gateway Platform efficiently.

---

## Part 1: Project Setup & Configuration

### Step 1: Initialize Project Structure

```bash
# Create root project directory
mkdir api-gateway && cd api-gateway

# Create backend directory
mkdir backend && cd backend
npm init -y
npm install express fastify fastify-cors fastify-jwt dotenv drizzle-orm pg crypto uuid zod pino pino-pretty weaviate-ts-client

# Install dev dependencies
npm install -D typescript @types/node tsx nodemon ts-node

# Create frontend directory
cd ../
mkdir frontend && cd frontend
npm create vite@latest . -- --template react-ts
npm install zustand axios react-router-dom @monaco-editor/react

# Go back to root
cd ../
```

### Step 2: Environment Setup

Create `.env.example` in root:
```env
# PostgreSQL
DATABASE_URL=postgresql://api_user:secure_password@localhost:5432/api_gateway

# Weaviate
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=weaviate-key

# JWT & Encryption
JWT_SECRET=your-very-long-random-secret-key-change-in-production
AES_SECRET=32-character-secret-key-here!

# Server
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
DEFAULT_RATE_LIMIT=100
```

---

## Part 2: Backend Implementation Guide

### 2.1: Database Schema (Drizzle)

**File: `backend/src/database/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
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
    tokenPrefix: varchar('token_prefix', { length: 10 }).notNull(), // e.g., "sk_test"
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
```

### 2.2: Encryption Service

**File: `backend/src/utils/encryption.ts`**

```typescript
import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  private static getKey(): Buffer {
    const secret = process.env.AES_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('AES_SECRET must be at least 32 characters');
    }
    return crypto.scryptSync(secret, 'salt', 32);
  }

  static encrypt(text: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;

    return result;
  }

  static decrypt(encrypted: string): string {
    try {
      const key = this.getKey();
      const parts = encrypted.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + (error as Error).message);
    }
  }

  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  static verify(plaintext: string, hash: string): boolean {
    return this.hash(plaintext) === hash;
  }
}
```

### 2.3: Token Service

**File: `backend/src/services/tokenService.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../config/database';
import { apiTokens } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { EncryptionService } from '../utils/encryption';

export class TokenService {
  static generateToken(): { prefix: string; full: string } {
    const prefix = 'sk_' + crypto.randomBytes(4).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    const full = prefix + '_' + secret;

    return { prefix, full };
  }

  static async createToken(
    userId: string,
    tokenName: string,
    expiresIn?: number
  ): Promise<{ token: string; tokenId: string; prefix: string }> {
    const { prefix, full } = this.generateToken();
    const hashedToken = EncryptionService.hash(full);

    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000);
    }

    const [result] = await db
      .insert(apiTokens)
      .values({
        id: uuidv4(),
        userId,
        tokenName,
        tokenValue: hashedToken,
        tokenPrefix: prefix,
        expiresAt,
      })
      .returning({ id: apiTokens.id });

    return {
      token: full, // Only shown once
      tokenId: result.id,
      prefix,
    };
  }

  static async validateToken(token: string): Promise<string | null> {
    const hashedToken = EncryptionService.hash(token);

    const [result] = await db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenValue, hashedToken),
          eq(apiTokens.isActive, true)
        )
      )
      .limit(1);

    if (!result) return null;

    // Check expiration
    if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
      return null;
    }

    // Update last used
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, result.id));

    return result.userId;
  }

  static async revokeToken(tokenId: string): Promise<void> {
    await db
      .update(apiTokens)
      .set({ isActive: false })
      .where(eq(apiTokens.id, tokenId));
  }
}
```

### 2.4: Authentication Service

**File: `backend/src/services/authService.ts`**

```typescript
import jwt from '@fastify/jwt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import { EncryptionService } from '../utils/encryption';

interface AuthPayload {
  userId: string;
  username: string;
}

export class AuthService {
  static async register(
    username: string,
    password: string,
    email: string,
    displayName: string
  ): Promise<{ userId: string; token: string }> {
    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Username already exists');
    }

    // Encrypt password
    const encryptedPassword = EncryptionService.encrypt(password);

    const userId = uuidv4();

    // Insert user
    await db.insert(users).values({
      id: userId,
      username,
      password: encryptedPassword,
      email,
      displayName,
    });

    const token = this.generateToken({ userId, username });

    return { userId, token };
  }

  static async login(username: string, password: string): Promise<{ userId: string; token: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Decrypt and verify password
    try {
      const decryptedPassword = EncryptionService.decrypt(user.password);
      if (decryptedPassword !== password) {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken({ userId: user.id, username: user.username });

    return { userId: user.id, token };
  }

  static generateToken(payload: AuthPayload): string {
    // This should be called by Fastify's sign method
    // But for demo purposes:
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
      expiresIn: '24h',
    });
  }

  static verifyToken(token: string): AuthPayload | null {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    } catch {
      return null;
    }
  }
}
```

### 2.5: Rate Limiting Middleware

**File: `backend/src/middleware/rateLimit.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../config/database';
import { endpoints, callLogs } from '../database/schema';
import { eq } from 'drizzle-orm';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get endpoint config
    const route = request.url.split('?')[0];
    const [endpoint] = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.route, route))
      .limit(1);

    if (!endpoint) {
      return; // Not a managed endpoint
    }

    const bucketKey = `${request.ip}-${endpoint.id}`;
    const now = Date.now();

    let bucket = buckets.get(bucketKey);

    if (!bucket) {
      bucket = {
        tokens: endpoint.rateLimit,
        lastRefill: now,
      };
    } else {
      // Refill tokens based on elapsed time
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = (elapsed / endpoint.rateLimitWindowMs) * endpoint.rateLimit;
      bucket.tokens = Math.min(endpoint.rateLimit, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      reply.code(429).send({ error: 'Rate limit exceeded' });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(bucketKey, bucket);

  } catch (error) {
    // Log but don't fail the request
    console.error('Rate limit check failed:', error);
  }
}
```

### 2.6: Main Server Setup

**File: `backend/src/main.ts`**

```typescript
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { config } from 'dotenv';

config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'change-me',
  sign: { expiresIn: '24h' },
});

app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

// Health check
app.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Routes
app.register(authRoutes, { prefix: '/auth' });
app.register(tokenRoutes, { prefix: '/api/tokens' });
app.register(endpointRoutes, { prefix: '/api/endpoints' });
app.register(schemaRoutes, { prefix: '/api/schemas' });
app.register(logRoutes, { prefix: '/api/logs' });
app.register(dynamicRoutes, { prefix: '/api/v1/endpoints' });

const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${process.env.PORT || 3001}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

---

## Part 3: Frontend Implementation Guide

### 3.1: Project Structure with Vite

**File: `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

### 3.2: Authentication Store (Zustand)

**File: `frontend/src/store/authStore.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string, displayName: string) => Promise<void>;
  logout: () => void;
  setAuth: (userId: string, username: string, token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      username: null,
      token: null,

      setAuth: (userId, username, token) => {
        set({ userId, username, token });
      },

      login: async (username, password) => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          throw new Error('Login failed');
        }

        const data = await response.json();
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      register: async (username, password, email, displayName) => {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, email, displayName }),
        });

        if (!response.ok) {
          throw new Error('Registration failed');
        }

        const data = await response.json();
        set({ userId: data.userId, username: data.username, token: data.token });
      },

      logout: () => {
        set({ userId: null, username: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### 3.3: API Client Service

**File: `frontend/src/services/api.ts`**

```typescript
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiClient {
  private static getHeaders() {
    const token = useAuthStore.getState().token;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth
  static login(username: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  static register(username: string, password: string, email: string, displayName: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, displayName }),
    });
  }

  // Endpoints
  static getEndpoints() {
    return this.request('/api/endpoints');
  }

  static getEndpoint(id: string) {
    return this.request(`/api/endpoints/${id}`);
  }

  static createEndpoint(data: any) {
    return this.request('/api/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static updateEndpoint(id: string, data: any) {
    return this.request(`/api/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static deleteEndpoint(id: string) {
    return this.request(`/api/endpoints/${id}`, { method: 'DELETE' });
  }

  // Schemas
  static getSchemas() {
    return this.request('/api/schemas');
  }

  static getSchema(id: string) {
    return this.request(`/api/schemas/${id}`);
  }

  static createSchema(data: any) {
    return this.request('/api/schemas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static updateSchema(id: string, data: any) {
    return this.request(`/api/schemas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static deleteSchema(id: string) {
    return this.request(`/api/schemas/${id}`, { method: 'DELETE' });
  }

  // Logs
  static getLogs(endpointId: string, query: any = {}) {
    const params = new URLSearchParams(query);
    return this.request(`/api/endpoints/${endpointId}/logs?${params}`);
  }

  static getLogStats(endpointId: string) {
    return this.request(`/api/endpoints/${endpointId}/logs/stats`);
  }
}
```

### 3.4: Protected Route Component

**File: `frontend/src/components/Auth/ProtectedRoute.tsx`**

```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### 3.5: Login Form Component

**File: `frontend/src/components/Auth/LoginForm.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 3.6: Schema Editor Component

**File: `frontend/src/components/Schemas/SchemaEditor.tsx`**

```typescript
import { useState } from 'react';
import { ApiClient } from '../../services/api';

export function SchemaEditor({ schemaId }: { schemaId?: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(''); // Markdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (schemaId) {
        await ApiClient.updateSchema(schemaId, { name, description, content });
      } else {
        await ApiClient.createSchema({ name, description, content });
      }
      // Success - navigate or show message
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Schema Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        placeholder="Markdown Content (Knowledge Base)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={15}
        style={{ fontFamily: 'monospace' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Schema'}
      </button>
    </form>
  );
}
```

---

## Part 4: Docker Setup

### 4.1: Docker Compose

**File: `docker-compose.yml` (root)**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: api_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: api_gateway
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U api_user -d api_gateway"]
      interval: 10s
      timeout: 5s
      retries: 5

  weaviate:
    image: semitechnologies/weaviate:latest
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_APIKEY_ENABLED: 'true'
      AUTHENTICATION_APIKEY_ALLOWED_KEYS: weaviate-key
      AUTHORIZATION_ADMIN_LIST: admin
    volumes:
      - weaviate_data:/var/lib/weaviate
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/v1/.well-known/ready"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://api_user:secure_password@postgres:5432/api_gateway
      WEAVIATE_URL: http://weaviate:8080
      WEAVIATE_API_KEY: weaviate-key
      JWT_SECRET: dev-jwt-secret-change-in-production
      AES_SECRET: dev-aes-secret-32-char-minimum!
      CORS_ORIGIN: http://localhost:3000
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
      weaviate:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:3001
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  weaviate_data:
```

### 4.2: Backend Dockerfile

**File: `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### 4.3: Frontend Dockerfile

**File: `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN npm install -g preview

EXPOSE 3000

CMD ["preview", "-l", "3000"]
```

---

## Implementation Checklist

### Backend
- [ ] Set up Drizzle ORM with PostgreSQL
- [ ] Create database migrations
- [ ] Implement EncryptionService (AES)
- [ ] Implement TokenService (generation, validation)
- [ ] Implement AuthService (register, login, JWT)
- [ ] Create rate limiting middleware
- [ ] Build API token CRUD endpoints
- [ ] Build endpoint management endpoints
- [ ] Build schema management endpoints
- [ ] Build forwarding flow executor
- [ ] Build call logs system
- [ ] Implement Weaviate integration
- [ ] Create dynamic endpoint routing
- [ ] Add error handling and validation

### Frontend
- [ ] Set up Vite + React + TypeScript
- [ ] Create auth pages (login, register)
- [ ] Build protected routes
- [ ] Create dashboard layout
- [ ] Build endpoint list and CRUD
- [ ] Build API token management UI
- [ ] Build schema editor with markdown
- [ ] Build forwarding flow builder
- [ ] Create call logs viewer with filters
- [ ] Add analytics dashboard
- [ ] Implement API client service
- [ ] Add Zustand stores for state
- [ ] Add error handling and loading states
- [ ] Style with CSS/TailwindCSS

### Docker & DevOps
- [ ] Create docker-compose.yml
- [ ] Create Dockerfiles for backend & frontend
- [ ] Test docker-compose up
- [ ] Set up environment variables
- [ ] Database migrations in container
- [ ] Health checks for all services

### Testing & Deployment
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test API endpoints with Postman/curl
- [ ] Test full user flow end-to-end
- [ ] Security review
- [ ] Performance testing
- [ ] Documentation

---

## Cursor Prompts to Use

When working with Cursor, use these prompts to guide implementation:

1. **"Create the Drizzle schema for [table name] with all required fields, indexes, and relations"**

2. **"Build a TypeScript service for [functionality] with proper error handling and logging"**

3. **"Create a Fastify route handler for [endpoint] that validates input and returns proper response"**

4. **"Build a React component for [UI element] that handles state and API calls using the ApiClient"**

5. **"Implement the [service name] with proper type safety and error handling"**

6. **"Create unit tests for [function name] covering success and error cases"**

7. **"Fix the TypeScript types for [component/function] to be fully type-safe"**

---

## Key Implementation Notes

1. **Always use prepared statements** - Drizzle ORM handles this automatically
2. **Validate all inputs** - Use Zod or similar validation library
3. **Hash sensitive data** - Never store plain passwords or tokens
4. **Implement proper error handling** - Meaningful error messages without exposing internals
5. **Add logging** - Use Pino or Winston for structured logging
6. **Use environment variables** - Never hardcode secrets
7. **Test security** - SQL injection, XSS, CSRF, rate limiting
8. **Document API** - Use OpenAPI/Swagger for API documentation
9. **Monitor performance** - Add timing logs and metrics
10. **Plan for scalability** - Redis for rate limiting, database indexing, caching

This specification and guide provides Cursor with everything needed to build a production-ready API Gateway Platform.
