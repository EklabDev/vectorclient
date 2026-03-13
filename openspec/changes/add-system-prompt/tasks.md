# Tasks: Add System Prompt & OpenAPI Doc

## 1. Database

- [x] 1.1 Add `system_prompt` (nullable text) to the schemas table in Drizzle schema
- [x] 1.2 Generate Drizzle migration for the new column
- [x] 1.3 Run migration in dev (document for uat/prod)

## 2. Backend API

- [x] 2.1 Include `system_prompt` in schema create payload (optional) and persist to DB
- [x] 2.2 Include `system_prompt` in schema update payload (optional) and persist to DB
- [x] 2.3 Return `system_prompt` in schema get and list responses

## 3. Frontend UI

- [x] 3.1 Add optional "System prompt" text area to schema create form and include in submit payload
- [x] 3.2 Add "System prompt" field to schema edit form; load current value and include in update payload
- [x] 3.3 Display system prompt in schema view (read-only) when present

## 4. OpenAPI document

- [x] 4.1 Create `docs/openapi.yaml` as valid OpenAPI 3.x with info and paths
- [x] 4.2 Document all current API endpoints (auth, schemas, endpoints, tokens, etc.) with request/response shapes
- [x] 4.3 Ensure schema resource in OpenAPI includes optional `system_prompt` (string; optional maxLength 5000 as hint)
