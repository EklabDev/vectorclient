# API Gateway Platform - Application Specification

## Project Overview

A comprehensive API management and routing platform with AI-powered knowledge management. Users can create custom API endpoints with advanced routing rules, rate limiting, and vector-based knowledge retrieval via Weaviate.

**Tech Stack:**
- **Frontend:** Vite + React + TypeScript
- **Backend:** Node.js + Express/Fastify + Drizzle ORM
- **Database:** PostgreSQL
- **Vector DB:** Weaviate
- **Containerization:** Docker & Docker Compose
- **Authentication:** JWT + AES Encryption

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                        │
├─────────────────┬───────────────────┬──────────────────────┤
│   Frontend      │    Backend        │  Infrastructure      │
│   (Vite)        │  (Node.js)        │                      │
│   Port: 3000    │  Port: 3001       │  PostgreSQL:5432    │
│                 │                   │  Weaviate:8080      │
└─────────────────┴───────────────────┴──────────────────────┘
```

---

## Database Schema (Drizzle)

### Users Table
```typescript
users {
  id: UUID (PK)
  username: string (unique)
  password: string (AES-256 encrypted)
  email: string
  displayName: string
  createdAt: timestamp
  updatedAt: timestamp
  isActive: boolean
}
```

### API Tokens Table
```typescript
apiTokens {
  id: UUID (PK)
  userId: UUID (FK -> users.id)
  tokenName: string
  tokenValue: string (hashed, unique)
  tokenPrefix: string (for display)
  isActive: boolean
  lastUsedAt: timestamp
  createdAt: timestamp
  expiresAt: timestamp (nullable)
}
```

### Endpoints Table
```typescript
endpoints {
  id: UUID (PK)
  userId: UUID (FK -> users.id)
  routeName: string
  route: string (unique per user)
  rateLimit: integer (requests per minute)
  rateLimitWindowMs: integer (default: 60000)
  allowedOrigins: string[] (JSON array, CORS)
  description: string (optional)
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Endpoint API Token Associations Table
```typescript
endpointApiTokens {
  id: UUID (PK)
  endpointId: UUID (FK -> endpoints.id)
  apiTokenId: UUID (FK -> apiTokens.id)
  createdAt: timestamp
  
  // Composite unique index on (endpointId, apiTokenId)
}
```

### Forwarding Flows Table
```typescript
forwardingFlows {
  id: UUID (PK)
  endpointId: UUID (FK -> endpoints.id)
  name: string
  order: integer (sequence of execution)
  flowType: enum ('proxy', 'transform', 'condition', 'webhook')
  config: JSON (flow-specific configuration)
  isEnabled: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Forwarding Flow Config Examples:**
```json
// Proxy flow
{
  "targetUrl": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": {"Authorization": "Bearer token"},
  "timeout": 30000
}

// Transform flow
{
  "transformationType": "jsonPath",
  "input": "$.data.result",
  "output": "$.processed"
}

// Condition flow
{
  "condition": "request.method === 'POST'",
  "trueFlowId": "uuid",
  "falseFlowId": "uuid"
}

// Webhook flow
{
  "webhookUrl": "https://example.com/webhook",
  "retries": 3,
  "timeout": 10000
}
```

### Schemas Table (Knowledge Base)
```typescript
schemas {
  id: UUID (PK)
  userId: UUID (FK -> users.id)
  name: string
  description: string
  content: text (Markdown content)
  weaviateCollectionId: string
  version: integer
  isPublished: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Endpoint Schema Associations Table
```typescript
endpointSchemas {
  id: UUID (PK)
  endpointId: UUID (FK -> endpoints.id)
  schemaId: UUID (FK -> schemas.id)
  order: integer (priority/order of retrieval)
  
  // Composite unique index on (endpointId, schemaId)
}
```

### API Call Logs Table
```typescript
callLogs {
  id: UUID (PK)
  endpointId: UUID (FK -> endpoints.id)
  apiTokenId: UUID (FK -> apiTokens.id, nullable)
  method: string
  path: string
  status: integer
  requestBody: text (first 10KB)
  responseBody: text (first 10KB)
  responseTime: integer (ms)
  ipAddress: string
  userAgent: string
  errorMessage: string (nullable)
  createdAt: timestamp
  
  // Indexes on (endpointId, createdAt), (userId, createdAt)
}
```

---

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
```json
Request:
{
  "username": "string",
  "password": "string",
  "email": "string",
  "displayName": "string"
}

Response: 201 Created
{
  "userId": "uuid",
  "username": "string",
  "email": "string",
  "token": "jwt"
}
```

#### POST /auth/login
```json
Request:
{
  "username": "string",
  "password": "string"
}

Response: 200 OK
{
  "userId": "uuid",
  "username": "string",
  "token": "jwt",
  "expiresIn": 86400
}
```

#### POST /auth/refresh
```json
Response: 200 OK
{
  "token": "jwt",
  "expiresIn": 86400
}
```

### API Token Endpoints

#### POST /api/tokens
```json
Request:
{
  "tokenName": "string",
  "expiresIn": "number | null" (days)
}

Response: 201 Created
{
  "id": "uuid",
  "tokenName": "string",
  "tokenValue": "prefix_xxxxx", // Only shown once
  "tokenPrefix": "prefix",
  "createdAt": "timestamp"
}
```

#### GET /api/tokens
```json
Response: 200 OK
{
  "tokens": [
    {
      "id": "uuid",
      "tokenName": "string",
      "tokenPrefix": "string",
      "isActive": boolean,
      "lastUsedAt": "timestamp",
      "createdAt": "timestamp",
      "expiresAt": "timestamp"
    }
  ]
}
```

#### PATCH /api/tokens/:tokenId
```json
Request:
{
  "tokenName": "string",
  "isActive": boolean
}

Response: 200 OK
{ token object }
```

#### DELETE /api/tokens/:tokenId
```json
Response: 204 No Content
```

### Endpoint Management Endpoints

#### POST /api/endpoints
```json
Request:
{
  "routeName": "string",
  "route": "string",
  "rateLimit": "number",
  "rateLimitWindowMs": "number",
  "allowedOrigins": ["string"],
  "description": "string"
}

Response: 201 Created
{
  "id": "uuid",
  "routeName": "string",
  "route": "string",
  "rateLimit": "number",
  "allowedOrigins": ["string"],
  "createdAt": "timestamp"
}
```

#### GET /api/endpoints
```json
Response: 200 OK
{
  "endpoints": [
    {
      "id": "uuid",
      "routeName": "string",
      "route": "string",
      "rateLimit": "number",
      "allowedOrigins": ["string"],
      "description": "string",
      "isActive": boolean,
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "apiTokenCount": "number",
      "schemaCount": "number"
    }
  ]
}
```

#### GET /api/endpoints/:endpointId
```json
Response: 200 OK
{
  "id": "uuid",
  "routeName": "string",
  "route": "string",
  "rateLimit": "number",
  "allowedOrigins": ["string"],
  "description": "string",
  "isActive": boolean,
  "apiTokens": [
    {
      "id": "uuid",
      "tokenName": "string",
      "tokenPrefix": "string"
    }
  ],
  "schemas": [
    {
      "id": "uuid",
      "name": "string",
      "order": "number"
    }
  ],
  "forwardingFlows": [
    {
      "id": "uuid",
      "name": "string",
      "order": "number",
      "flowType": "string"
    }
  ],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### PATCH /api/endpoints/:endpointId
```json
Request:
{
  "routeName": "string",
  "rateLimit": "number",
  "allowedOrigins": ["string"],
  "description": "string",
  "isActive": boolean
}

Response: 200 OK
{ endpoint object }
```

#### DELETE /api/endpoints/:endpointId
```json
Response: 204 No Content
```

### Endpoint Configuration - API Tokens

#### POST /api/endpoints/:endpointId/api-tokens/:apiTokenId
```json
Response: 201 Created
{
  "id": "uuid",
  "endpointId": "uuid",
  "apiTokenId": "uuid"
}
```

#### DELETE /api/endpoints/:endpointId/api-tokens/:apiTokenId
```json
Response: 204 No Content
```

### Endpoint Configuration - Schemas

#### POST /api/endpoints/:endpointId/schemas/:schemaId
```json
Request:
{
  "order": "number"
}

Response: 201 Created
{
  "id": "uuid",
  "endpointId": "uuid",
  "schemaId": "uuid",
  "order": "number"
}
```

#### PATCH /api/endpoints/:endpointId/schemas/:schemaId
```json
Request:
{
  "order": "number"
}

Response: 200 OK
{ schema association object }
```

#### DELETE /api/endpoints/:endpointId/schemas/:schemaId
```json
Response: 204 No Content
```

### Forwarding Flows Endpoints

#### POST /api/endpoints/:endpointId/flows
```json
Request:
{
  "name": "string",
  "order": "number",
  "flowType": "proxy | transform | condition | webhook",
  "config": "object",
  "isEnabled": boolean
}

Response: 201 Created
{ forwarding flow object }
```

#### GET /api/endpoints/:endpointId/flows
```json
Response: 200 OK
{
  "flows": [
    {
      "id": "uuid",
      "name": "string",
      "order": "number",
      "flowType": "string",
      "config": "object",
      "isEnabled": boolean
    }
  ]
}
```

#### PATCH /api/endpoints/:endpointId/flows/:flowId
```json
Request:
{
  "name": "string",
  "order": "number",
  "flowType": "string",
  "config": "object",
  "isEnabled": boolean
}

Response: 200 OK
{ forwarding flow object }
```

#### DELETE /api/endpoints/:endpointId/flows/:flowId
```json
Response: 204 No Content
```

### Schema Management Endpoints

#### POST /api/schemas
```json
Request:
{
  "name": "string",
  "description": "string",
  "content": "markdown string"
}

Response: 201 Created
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "content": "string",
  "version": 1,
  "isPublished": false,
  "weaviateCollectionId": "string",
  "createdAt": "timestamp"
}
```

#### GET /api/schemas
```json
Response: 200 OK
{
  "schemas": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "version": "number",
      "isPublished": boolean,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

#### GET /api/schemas/:schemaId
```json
Response: 200 OK
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "content": "string",
  "version": "number",
  "isPublished": boolean,
  "weaviateCollectionId": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### PATCH /api/schemas/:schemaId
```json
Request:
{
  "name": "string",
  "description": "string",
  "content": "markdown string",
  "isPublished": boolean
}

Response: 200 OK
{ schema object }

Note: Creating new version on content change, maintaining version history
```

#### DELETE /api/schemas/:schemaId
```json
Response: 204 No Content
```

### Call Logs Endpoints

#### GET /api/endpoints/:endpointId/logs
```json
Request Query:
{
  "page": "number" (default: 1),
  "limit": "number" (default: 50, max: 500),
  "status": "number" (optional, filter by status code),
  "method": "string" (optional, GET|POST|PUT|DELETE),
  "startDate": "ISO string" (optional),
  "endDate": "ISO string" (optional),
  "sortBy": "createdAt | responseTime | status" (default: createdAt),
  "sortOrder": "asc | desc" (default: desc)
}

Response: 200 OK
{
  "logs": [
    {
      "id": "uuid",
      "method": "string",
      "path": "string",
      "status": "number",
      "responseTime": "number",
      "ipAddress": "string",
      "userAgent": "string",
      "errorMessage": "string | null",
      "createdAt": "timestamp"
    }
  ],
  "total": "number",
  "page": "number",
  "limit": "number",
  "pages": "number"
}
```

#### GET /api/endpoints/:endpointId/logs/:logId
```json
Response: 200 OK
{
  "id": "uuid",
  "endpointId": "uuid",
  "apiTokenId": "uuid | null",
  "method": "string",
  "path": "string",
  "status": "number",
  "requestBody": "string",
  "responseBody": "string",
  "responseTime": "number",
  "ipAddress": "string",
  "userAgent": "string",
  "errorMessage": "string | null",
  "createdAt": "timestamp"
}
```

#### GET /api/endpoints/:endpointId/logs/stats
```json
Response: 200 OK
{
  "totalRequests": "number",
  "successfulRequests": "number",
  "failedRequests": "number",
  "averageResponseTime": "number",
  "requestsPerMinute": "number",
  "topStatusCodes": [
    { "code": "number", "count": "number" }
  ],
  "topMethods": [
    { "method": "string", "count": "number" }
  ]
}
```

### Dynamic Endpoint Execution

#### POST /api/v1/endpoints/:userSlug/:endpointRoute (Dynamic Route)
```
This is the user-created endpoint that handles actual requests.
- Validates API token from header: Authorization: Bearer <token>
- Checks rate limiting
- Validates CORS origin
- Executes forwarding flows
- Retrieves context from Weaviate schemas if needed
- Logs all requests
- Returns response

Request:
Any method, any body structure

Response:
Based on forwarding flow configuration
```

---

## Frontend Architecture

### Pages

1. **Authentication**
   - Login page
   - Register page

2. **Dashboard**
   - Overview with statistics
   - Quick endpoint list
   - Recent activity feed

3. **Endpoints Management**
   - List endpoints
   - Create/Edit endpoint form
   - Endpoint detail view
   - Configure API tokens for endpoint
   - Configure schemas for endpoint
   - Manage forwarding flows UI

4. **API Tokens**
   - List tokens
   - Create token modal
   - Revoke/manage tokens

5. **Schemas**
   - List schemas
   - Create schema with markdown editor
   - Edit schema
   - Preview schema

6. **Call Logs Viewer**
   - Filterable log table
   - Log detail modal
   - Analytics dashboard (charts/stats)
   - Export logs

7. **Settings**
   - User profile
   - Account security
   - API quota info

### Components

```
src/
├── components/
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── Endpoints/
│   │   ├── EndpointForm.tsx
│   │   ├── EndpointList.tsx
│   │   ├── EndpointDetail.tsx
│   │   ├── ForwardingFlowBuilder.tsx
│   │   └── SchemaSelector.tsx
│   ├── Tokens/
│   │   ├── TokenList.tsx
│   │   ├── TokenCreateModal.tsx
│   │   └── TokenDisplay.tsx
│   ├── Schemas/
│   │   ├── SchemaEditor.tsx (with Markdown)
│   │   ├── SchemaList.tsx
│   │   └── SchemaPreview.tsx
│   ├── Logs/
│   │   ├── LogTable.tsx
│   │   ├── LogDetail.tsx
│   │   ├── LogFilters.tsx
│   │   └── LogStats.tsx
│   └── Common/
│       ├── Layout.tsx
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── pages/
│   ├── auth/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── dashboard.tsx
│   ├── endpoints/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   └── create.tsx
│   ├── tokens.tsx
│   ├── schemas/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   └── create.tsx
│   ├── logs.tsx
│   └── settings.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useEndpoints.ts
│   ├── useTokens.ts
│   ├── useSchemas.ts
│   └── useLogs.ts
├── services/
│   ├── api.ts
│   ├── auth.ts
│   ├── endpoints.ts
│   ├── tokens.ts
│   ├── schemas.ts
│   └── logs.ts
├── store/
│   ├── authStore.ts
│   ├── endpointStore.ts
│   └── notificationStore.ts
├── types/
│   └── index.ts
└── App.tsx
```

---

## Backend Architecture

### Core Modules

```
src/
├── main.ts (entry point)
├── config/
│   ├── database.ts (Drizzle + PostgreSQL)
│   ├── weaviate.ts (Weaviate client)
│   ├── env.ts (environment variables)
│   └── constants.ts
├── middleware/
│   ├── auth.ts (JWT verification)
│   ├── rateLimit.ts (token bucket algorithm)
│   ├── cors.ts
│   ├── errorHandler.ts
│   ├── logging.ts
│   └── validation.ts
├── routes/
│   ├── auth.ts
│   ├── tokens.ts
│   ├── endpoints.ts
│   ├── schemas.ts
│   ├── logs.ts
│   └── dynamic.ts (user-created endpoints)
├── controllers/
│   ├── authController.ts
│   ├── tokenController.ts
│   ├── endpointController.ts
│   ├── schemaController.ts
│   └── logController.ts
├── services/
│   ├── authService.ts
│   ├── tokenService.ts
│   ├── endpointService.ts
│   ├── schemaService.ts
│   ├── logService.ts
│   ├── weaviateService.ts
│   ├── flowExecutorService.ts
│   └── encryptionService.ts
├── database/
│   ├── schema.ts (Drizzle schema definitions)
│   └── migrations/
│       ├── 001_initial_schema.ts
│       ├── 002_add_call_logs.ts
│       └── ...
├── utils/
│   ├── encryption.ts (AES encryption/decryption)
│   ├── tokenGenerator.ts (secure token generation)
│   ├── validators.ts
│   ├── helpers.ts
│   └── logger.ts
└── types/
    └── index.ts
```

### Key Services

#### EncryptionService
```typescript
// AES-256-GCM encryption for passwords
- encryptPassword(password: string): string
- decryptPassword(encrypted: string): string
- verifyPassword(plaintext: string, encrypted: string): boolean
```

#### TokenService
```typescript
// API token management
- generateToken(): { prefix: string; value: string }
- hashToken(token: string): string
- validateToken(token: string): Promise<TokenRecord>
- revokeToken(tokenId: uuid): Promise<void>
```

#### WeaviateService
```typescript
// Vector DB operations
- createCollection(schemaId: uuid, content: string): Promise<collectionId>
- updateCollection(collectionId: string, content: string): Promise<void>
- deleteCollection(collectionId: string): Promise<void>
- queryCollection(collectionId: string, query: string, limit?: number): Promise<SearchResults>
- embedAndStore(collectionId: string, chunks: string[]): Promise<void>
```

#### FlowExecutorService
```typescript
// Execute forwarding flows in sequence
- executeFlow(endpoint, request, context): Promise<Response>
- executeProxyFlow(config, request): Promise<Response>
- executeTransformFlow(config, data): Promise<Response>
- executeConditionFlow(config, request, context): Promise<Response>
- executeWebhookFlow(config, data): Promise<void>
```

#### LogService
```typescript
// Async logging with batching
- logRequest(endpointId, request, response): Promise<void>
- getLogs(endpointId, filters): Promise<PaginatedLogs>
- getStats(endpointId, dateRange): Promise<Stats>
- pruneOldLogs(daysToKeep): Promise<void>
```

---

## Docker Configuration

### docker-compose.yml
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
      JWT_SECRET: your-jwt-secret-key
      AES_SECRET: your-aes-secret-key-32-chars
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

### Backend Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

ENV HOST=0.0.0.0

CMD ["npm", "run", "dev"]
```

---

## Security Considerations

### Password Security
- **Algorithm:** AES-256-GCM encryption
- **Storage:** Encrypted passwords stored in DB
- **Key Management:** AES_SECRET stored in environment variables only
- **Never:** Store plain passwords or log them

### API Token Security
- **Generation:** Cryptographically secure random bytes
- **Format:** `prefix_xxxxx` (visible prefix for UX, actual token hashed)
- **Storage:** Only hashed tokens stored in DB
- **Validation:** Compare hash on each request
- **Expiration:** Optional per-token expiration

### JWT Security
- **Algorithm:** HS256
- **Expiration:** 24 hours (configurable)
- **Refresh:** Support refresh token endpoint
- **Secret:** Stored in environment only

### Rate Limiting
- **Algorithm:** Token bucket per endpoint + API token combo
- **Storage:** Redis for distributed rate limiting (future enhancement)
- **Tracking:** Per-IP address and per-API-token

### CORS
- **Validation:** Endpoint's allowedOrigins list
- **Preflight:** Automatic CORS preflight handling

### Data Validation
- **Input:** Zod/Joi validation on all endpoints
- **SQL Injection:** Drizzle ORM parameterized queries
- **XSS:** Frontend sanitization + CSP headers

---

## Environment Variables

```env
# Node
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/api_gateway

# Weaviate
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=weaviate-key

# Security
JWT_SECRET=your-very-long-random-secret-key-here
AES_SECRET=32-character-secret-key-here!  # Must be 32 chars
JWT_EXPIRY=86400  # 24 hours

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
DEFAULT_RATE_LIMIT=100  # requests per minute

# Logging
LOG_LEVEL=debug
LOG_RETENTION_DAYS=30

# Frontend (for Vite)
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=API Gateway
```

---

## Development Workflow

### Getting Started

```bash
# Clone and setup
git clone <repo>
cd api-gateway
docker-compose up -d

# Backend development
cd backend
npm install
npm run dev

# Frontend development (in another terminal)
cd frontend
npm install
npm run dev

# Access
Frontend: http://localhost:3000
Backend: http://localhost:3001
Weaviate: http://localhost:8080
```

### Database Migrations

```bash
# Backend directory
npm run migrate:create -- create_users_table
npm run migrate:up
npm run migrate:down
```

### Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests (frontend)
npm run test:e2e
```

---

## Future Enhancements

1. **Advanced Analytics Dashboard**
   - Real-time metrics with WebSockets
   - Custom time range analytics
   - Export reports (PDF, CSV)

2. **Distributed Rate Limiting**
   - Redis integration for multi-instance deployments
   - Sliding window algorithm

3. **Advanced Forwarding Flows**
   - Conditional logic builder UI
   - Webhook notifications
   - Custom JavaScript transformations

4. **API Documentation**
   - Auto-generated OpenAPI/Swagger specs
   - Interactive API explorer

5. **Team Collaboration**
   - Workspace sharing
   - Role-based access control (RBAC)
   - Audit logs

6. **AI Features**
   - Auto-generate endpoints from natural language
   - Smart schema suggestions from logs
   - Anomaly detection in call patterns

7. **Observability**
   - Integration with Sentry/DataDog
   - Custom alerting rules
   - Health checks

---

## File Structure Summary

```
api-gateway/
├── docker-compose.yml
├── .env.example
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       ├── store/
│       ├── types/
│       └── styles/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── main.ts
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── database/
│       ├── utils/
│       └── types/
└── README.md
```

---

## Notes for Cursor Implementation

1. **Start with Backend First:**
   - Set up Drizzle schema and database migrations
   - Implement authentication service (JWT + AES encryption)
   - Create API token service with hashing
   - Build core CRUD endpoints

2. **Then Frontend:**
   - Set up Vite + React + TypeScript project
   - Create authentication pages and protected routes
   - Build endpoint management UI
   - Add markdown editor for schemas

3. **Integration:**
   - Connect frontend API calls to backend
   - Implement dynamic endpoint routing
   - Add Weaviate integration for schema search
   - Build call logs viewer

4. **Docker:**
   - Test docker-compose setup
   - Ensure all services communicate properly
   - Set up health checks

5. **Testing & Deployment:**
   - Write tests for critical paths
   - Document API endpoints
   - Create deployment guide

---

## Success Criteria

- ✅ Users can register and login securely
- ✅ Create/manage API tokens with proper security
- ✅ Create and configure custom endpoints
- ✅ Endpoint configuration: route, rate limit, CORS, tokens, schemas
- ✅ Dynamic endpoint execution with forwarding flows
- ✅ Markdown-based schema editor storing to Weaviate
- ✅ Comprehensive call logging and filtering
- ✅ Full Docker containerization
- ✅ Production-ready security practices
