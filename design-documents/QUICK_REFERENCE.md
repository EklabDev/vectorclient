# API Gateway Platform - Quick Reference Guide

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's Browser                             │
│                   (http://localhost:3000)                         │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │   Frontend (Vite + React) │
                    │   - Auth Pages            │
                    │   - Dashboard             │
                    │   - Endpoint Management   │
                    │   - Schema Editor         │
                    │   - Call Logs Viewer      │
                    └────────────┬──────────────┘
                                 │ HTTP/CORS
                    ┌────────────▼──────────────┐
                    │  Backend (Fastify/Express)│
                    │  (http://localhost:3001)  │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │ Auth Service        │   │
                    │ │ Token Service       │   │
                    │ │ Endpoint Service    │   │
                    │ │ Schema Service      │   │
                    │ │ Flow Executor       │   │
                    │ │ Log Service         │   │
                    │ └─────────────────────┘   │
                    └────────┬────────┬────────┘
                             │        │
         ┌───────────────────┘        └─────────────┐
         │                                           │
    ┌────▼─────────────┐               ┌────────────▼────┐
    │  PostgreSQL      │               │ Weaviate Vector │
    │  (port 5432)     │               │ DB (port 8080)  │
    │                  │               │                 │
    │ - Users          │               │ - Knowledge     │
    │ - API Tokens     │               │   Embeddings    │
    │ - Endpoints      │               │ - Collections   │
    │ - Schemas        │               │ - Vectors       │
    │ - Call Logs      │               │                 │
    └──────────────────┘               └─────────────────┘
         ▲                                      ▲
         └──────────────────┬───────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │   Docker Container Network         │
         │   (docker-compose.yml)              │
         └─────────────────────────────────────┘
```

## Data Flow - User Request to Managed Endpoint

```
1. User makes request to: POST /api/v1/endpoints/{userId}/{endpointRoute}
   Example: POST /api/v1/endpoints/john-doe/webhook/payment

2. Backend receives request:
   ├─ Extract endpoint info from database
   ├─ Validate API token (if provided)
   ├─ Check rate limiting
   ├─ Validate CORS origin
   └─ Process forwarding flows

3. Forwarding Flows Execution (in order):
   ├─ Flow 1: Proxy (forward to external API)
   ├─ Flow 2: Transform (modify data)
   ├─ Flow 3: Condition (branching logic)
   └─ Flow 4: Webhook (send to webhook)

4. Query Weaviate for context:
   └─ If schemas attached, retrieve relevant knowledge
   
5. Log the request:
   ├─ Method, path, status
   ├─ Request/response bodies
   ├─ Response time
   ├─ IP address, user agent
   └─ Error messages

6. Return response to client
```

## File Structure (Complete)

```
api-gateway/
│
├── docker-compose.yml                    # Main container orchestration
├── .env.example                          # Environment variables template
├── .gitignore
└── README.md

├── frontend/                             # React + Vite App
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx                     # Entry point
│       ├── App.tsx                      # Root component
│       │
│       ├── pages/                       # Page components
│       │   ├── auth/
│       │   │   ├── login.tsx
│       │   │   └── register.tsx
│       │   ├── dashboard.tsx
│       │   ├── endpoints/
│       │   │   ├── index.tsx            # List endpoints
│       │   │   ├── [id].tsx             # View/edit endpoint
│       │   │   └── create.tsx
│       │   ├── schemas/
│       │   │   ├── index.tsx
│       │   │   ├── [id].tsx
│       │   │   └── create.tsx
│       │   ├── tokens.tsx
│       │   ├── logs.tsx
│       │   └── settings.tsx
│       │
│       ├── components/                  # Reusable components
│       │   ├── Auth/
│       │   │   ├── LoginForm.tsx
│       │   │   ├── RegisterForm.tsx
│       │   │   └── ProtectedRoute.tsx
│       │   ├── Endpoints/
│       │   │   ├── EndpointForm.tsx
│       │   │   ├── EndpointList.tsx
│       │   │   ├── EndpointDetail.tsx
│       │   │   ├── ForwardingFlowBuilder.tsx
│       │   │   └── SchemaSelector.tsx
│       │   ├── Tokens/
│       │   │   ├── TokenList.tsx
│       │   │   ├── TokenCreateModal.tsx
│       │   │   └── TokenDisplay.tsx
│       │   ├── Schemas/
│       │   │   ├── SchemaEditor.tsx
│       │   │   ├── SchemaList.tsx
│       │   │   └── SchemaPreview.tsx
│       │   ├── Logs/
│       │   │   ├── LogTable.tsx
│       │   │   ├── LogDetail.tsx
│       │   │   ├── LogFilters.tsx
│       │   │   └── LogStats.tsx
│       │   └── Common/
│       │       ├── Layout.tsx
│       │       ├── Header.tsx
│       │       ├── Sidebar.tsx
│       │       ├── LoadingSpinner.tsx
│       │       └── ErrorBoundary.tsx
│       │
│       ├── hooks/                       # Custom React hooks
│       │   ├── useAuth.ts
│       │   ├── useEndpoints.ts
│       │   ├── useTokens.ts
│       │   ├── useSchemas.ts
│       │   └── useLogs.ts
│       │
│       ├── services/                    # API client services
│       │   ├── api.ts                   # Main API client
│       │   ├── endpoints.ts
│       │   ├── tokens.ts
│       │   ├── schemas.ts
│       │   └── logs.ts
│       │
│       ├── store/                       # Zustand stores
│       │   ├── authStore.ts
│       │   ├── endpointStore.ts
│       │   ├── schemaStore.ts
│       │   └── notificationStore.ts
│       │
│       ├── types/                       # TypeScript types
│       │   └── index.ts
│       │
│       └── styles/
│           ├── globals.css
│           └── components/
│
├── backend/                             # Node.js + Fastify
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   │
│   └── src/
│       ├── main.ts                      # Application entry point
│       │
│       ├── config/                      # Configuration
│       │   ├── database.ts              # Drizzle + PostgreSQL
│       │   ├── weaviate.ts              # Weaviate client
│       │   ├── env.ts                   # Environment validation
│       │   └── constants.ts
│       │
│       ├── middleware/                  # Express/Fastify middleware
│       │   ├── auth.ts                  # JWT verification
│       │   ├── rateLimit.ts             # Token bucket algorithm
│       │   ├── cors.ts                  # CORS handling
│       │   ├── errorHandler.ts          # Global error handler
│       │   ├── logging.ts               # Request logging
│       │   └── validation.ts            # Input validation
│       │
│       ├── routes/                      # API route definitions
│       │   ├── auth.ts                  # /auth/*
│       │   ├── tokens.ts                # /api/tokens/*
│       │   ├── endpoints.ts             # /api/endpoints/*
│       │   ├── schemas.ts               # /api/schemas/*
│       │   ├── logs.ts                  # /api/logs/*
│       │   └── dynamic.ts               # /api/v1/endpoints/* (user routes)
│       │
│       ├── controllers/                 # Route handlers
│       │   ├── authController.ts
│       │   ├── tokenController.ts
│       │   ├── endpointController.ts
│       │   ├── schemaController.ts
│       │   └── logController.ts
│       │
│       ├── services/                    # Business logic
│       │   ├── authService.ts           # Auth logic
│       │   ├── tokenService.ts          # Token management
│       │   ├── endpointService.ts       # Endpoint logic
│       │   ├── schemaService.ts         # Schema logic
│       │   ├── logService.ts            # Logging logic
│       │   ├── weaviateService.ts       # Vector DB operations
│       │   ├── flowExecutorService.ts   # Execute forwarding flows
│       │   └── encryptionService.ts     # AES encryption
│       │
│       ├── database/                    # Database schema & migrations
│       │   ├── schema.ts                # Drizzle ORM schema
│       │   └── migrations/
│       │       ├── 001_initial.ts
│       │       ├── 002_add_logs.ts
│       │       └── ...
│       │
│       ├── utils/                       # Utility functions
│       │   ├── encryption.ts            # AES encryption/decryption
│       │   ├── tokenGenerator.ts        # Secure token generation
│       │   ├── validators.ts            # Zod schemas
│       │   ├── helpers.ts               # Helper functions
│       │   └── logger.ts                # Structured logging
│       │
│       └── types/                       # TypeScript types
│           └── index.ts
│
└── docs/                                # Documentation
    ├── API.md                           # API documentation
    ├── SETUP.md                         # Setup instructions
    └── DEPLOYMENT.md                    # Deployment guide
```

## API Endpoint Summary

### Authentication
```
POST   /auth/register                    # User registration
POST   /auth/login                       # User login
POST   /auth/refresh                     # Refresh JWT token
```

### API Tokens
```
POST   /api/tokens                       # Create token
GET    /api/tokens                       # List tokens
PATCH  /api/tokens/:tokenId              # Update token
DELETE /api/tokens/:tokenId              # Revoke token
```

### Endpoints
```
POST   /api/endpoints                    # Create endpoint
GET    /api/endpoints                    # List user's endpoints
GET    /api/endpoints/:id                # Get endpoint details
PATCH  /api/endpoints/:id                # Update endpoint
DELETE /api/endpoints/:id                # Delete endpoint
```

### Endpoint Configuration - Tokens
```
POST   /api/endpoints/:id/api-tokens/:tokenId      # Add token to endpoint
DELETE /api/endpoints/:id/api-tokens/:tokenId      # Remove token from endpoint
```

### Endpoint Configuration - Schemas
```
POST   /api/endpoints/:id/schemas/:schemaId        # Add schema to endpoint
PATCH  /api/endpoints/:id/schemas/:schemaId        # Update schema order
DELETE /api/endpoints/:id/schemas/:schemaId        # Remove schema from endpoint
```

### Forwarding Flows
```
POST   /api/endpoints/:id/flows                    # Create flow
GET    /api/endpoints/:id/flows                    # List flows
PATCH  /api/endpoints/:id/flows/:flowId            # Update flow
DELETE /api/endpoints/:id/flows/:flowId            # Delete flow
```

### Schemas
```
POST   /api/schemas                                # Create schema
GET    /api/schemas                                # List user's schemas
GET    /api/schemas/:id                            # Get schema details
PATCH  /api/schemas/:id                            # Update schema
DELETE /api/schemas/:id                            # Delete schema
```

### Call Logs
```
GET    /api/endpoints/:id/logs                     # List logs (paginated)
GET    /api/endpoints/:id/logs/:logId              # Get log details
GET    /api/endpoints/:id/logs/stats               # Get analytics
```

### Dynamic Endpoints (Created by Users)
```
POST   /api/v1/endpoints/:userSlug/:routeName    # User's custom endpoint
GET    /api/v1/endpoints/:userSlug/:routeName    # User's custom endpoint
PUT    /api/v1/endpoints/:userSlug/:routeName    # User's custom endpoint
DELETE /api/v1/endpoints/:userSlug/:routeName    # User's custom endpoint
```

## Database Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | username, email, password (encrypted) |
| `apiTokens` | API authentication tokens | tokenValue (hashed), userId |
| `endpoints` | User-created API endpoints | route, rateLimit, allowedOrigins |
| `endpointApiTokens` | Token-to-endpoint mapping | endpointId, apiTokenId |
| `forwardingFlows` | Request processing steps | flowType, config, order |
| `schemas` | Knowledge bases | content (markdown), weaviateCollectionId |
| `endpointSchemas` | Schema-to-endpoint mapping | endpointId, schemaId |
| `callLogs` | Request/response history | method, status, responseTime |

## Environment Variables Checklist

```env
✓ NODE_ENV                      # development | production
✓ PORT                          # Backend port (default 3001)
✓ DATABASE_URL                  # PostgreSQL connection string
✓ WEAVIATE_URL                  # Weaviate endpoint
✓ WEAVIATE_API_KEY              # Weaviate authentication
✓ JWT_SECRET                    # JWT signing secret (min 32 chars)
✓ JWT_EXPIRY                    # Token expiration (e.g., "24h")
✓ AES_SECRET                    # AES encryption key (exactly 32 chars)
✓ CORS_ORIGIN                   # Frontend URL for CORS
✓ RATE_LIMIT_WINDOW_MS          # Rate limit window (ms)
✓ DEFAULT_RATE_LIMIT            # Default requests per window
✓ LOG_LEVEL                     # debug | info | warn | error
✓ LOG_RETENTION_DAYS            # How long to keep logs
✓ VITE_API_URL                  # Backend URL for frontend
```

## Security Checklist

- [ ] AES-256-GCM encryption for passwords
- [ ] Hashed API tokens (SHA-256)
- [ ] JWT tokens with expiration
- [ ] Rate limiting per endpoint + token
- [ ] CORS validation
- [ ] Input validation with Zod
- [ ] SQL injection prevention (Drizzle ORM)
- [ ] XSS prevention (React escaping)
- [ ] CSRF protection
- [ ] No sensitive data in logs
- [ ] Environment variables for secrets
- [ ] HTTPS in production
- [ ] Database backups
- [ ] Audit logs for sensitive operations

## Performance Optimization Tips

1. **Database**: Add indexes on frequently queried columns
2. **Caching**: Use Redis for rate limiting and session caching
3. **Batch Operations**: Batch log writes to database
4. **Pagination**: Implement for large result sets
5. **Compression**: Enable gzip compression on responses
6. **CDN**: Serve static frontend assets from CDN
7. **Lazy Loading**: Load components on demand in frontend
8. **Database Queries**: Use SELECT to fetch only needed columns
9. **Connection Pooling**: Configure database connection pools
10. **Monitoring**: Use APM tools to identify bottlenecks

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- Token generation and validation
- Rate limiting logic
- Validators and helpers

### Integration Tests
- Auth flow (register → login → token usage)
- Endpoint CRUD operations
- Schema management with Weaviate
- Forwarding flow execution

### E2E Tests
- Complete user journey
- Create endpoint → Configure → Use → View logs
- API token lifecycle
- Schema editor workflow

### Load Testing
- Concurrent request handling
- Rate limiting under load
- Database query performance
- Weaviate vector search performance

## Deployment Considerations

1. **Environment**: Use environment variables for all config
2. **Secrets**: Use secret management (AWS Secrets Manager, etc.)
3. **Scaling**: Design for horizontal scaling with Docker Swarm/Kubernetes
4. **Database**: Set up replication and backups
5. **Monitoring**: Implement health checks and alerting
6. **Logging**: Centralize logs with ELK or similar
7. **CI/CD**: Automate testing and deployment
8. **Security**: Regular security audits and updates
9. **Performance**: Monitor and optimize slow queries
10. **Documentation**: Keep README and API docs updated

## Getting Started Commands

```bash
# Clone and enter directory
git clone <repo>
cd api-gateway

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Create database tables
docker-compose exec backend npm run migrate:up

# Stop services
docker-compose down

# Rebuild containers
docker-compose up -d --build
```

## Key Concepts

### Token Bucket Rate Limiting
- Each endpoint/token combo has a bucket of tokens
- Tokens refill at a configured rate
- Each request consumes 1 token
- No more tokens = request rejected (429)

### Forwarding Flows
- Sequential execution of request processors
- Types: proxy, transform, condition, webhook
- Can branch based on conditions
- Enables flexible request processing

### Weaviate Integration
- Vector database for semantic search
- Stores markdown schemas as embeddings
- Enables context-aware responses
- Used for intelligent request handling

### API Token Security
- Prefix visible to user (UX)
- Actual token hashed in database
- Only shown once at creation
- Can be revoked anytime

### AES Encryption
- Password encryption with AES-256-GCM
- IV and auth tag stored with encrypted data
- Key derived from environment secret
- Prevents plaintext password storage

This quick reference covers the essential information for developing and deploying the API Gateway Platform!
