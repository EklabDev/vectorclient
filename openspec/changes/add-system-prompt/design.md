## Context

- **Current state**: The `schemas` table (Knowledge Base) has `name`, `description`, `content`, `weaviateCollectionId`, `version`, `isPublished`, and timestamps. Schema API supports create, list, get, update, delete; the frontend Schemas & Knowledge page provides CRUD for name, description, and content (markdown). There is no system prompt field; AI agents cannot be given a per-schema system prompt from this app.
- **Stakeholders**: Backend (Node/TypeScript, Fastify, Drizzle), frontend (React), API consumers. Downstream: AI agents or services that use schema metadata and need a system prompt.
- **Constraints**: Additive change only—no breaking API or DB contract. Existing schema rows must remain valid. OpenAPI doc should reflect the full API after the change.

## Goals / Non-Goals

**Goals:**

- Add optional `system_prompt` (text) to the Schemas table and expose it via API and UI (create, read, update).
- Update the Schemas & Knowledge UI with a text field for system prompt in create, view, and edit flows.
- Produce a single OpenAPI document describing all current endpoints, including the schema resource with `system_prompt`.

**Non-Goals:**

- Changing how system prompt is *consumed* by agents (e.g. wiring into inference pipelines); this change only stores and exposes the value.
- Versioning or audit history for system prompt; same lifecycle as the schema row.
- OpenAPI code-generation or runtime validation from the spec in this change.

## Decisions

1. **Column type and nullability**
   - **Choice**: Add `system_prompt` as nullable `text` (no length limit).
   - **Rationale**: System prompts can be long; text is consistent with `content` and `description`. Nullable keeps existing rows valid and allows “no system prompt” without storing empty string.
   - **Alternative**: `varchar(n)` — rejected to avoid arbitrary length limits.

2. **API shape**
   - **Choice**: Include `system_prompt` in schema create body (optional), in get/list responses, and in update body (optional). Same JSON key `system_prompt` (string | null).
   - **Rationale**: Additive field; existing clients ignore it. No new endpoints.
   - **Alternative**: Separate “patch system prompt” endpoint — rejected as unnecessary for a single optional field.

3. **UI placement**
   - **Choice**: Add a single “System prompt” text area (or text field) on the Schemas create/edit form and in the view modal, alongside name, description, and content. Same pattern as description (optional, multi-line friendly).
   - **Rationale**: Keeps all schema fields in one place; minimal UX change.
   - **Alternative**: Separate “System prompt” tab or page — rejected for scope.

4. **OpenAPI document location and format**
   - **Choice**: Single OpenAPI 3.x document at **`docs/openapi.yaml`** in the repo. Document all existing endpoints plus schema with `system_prompt`. The spec is file-only; **not served over HTTP**.
   - **Rationale**: One source of truth for the API contract; can be used by clients, SDKs, or external tools. Keeping it in `docs/` and not serving it avoids extra routes and keeps the API surface minimal.
   - **Alternative**: Serve via `GET /openapi.json` — rejected; file-only at `docs/openapi.yaml` per requirement.

5. **Migration strategy**
   - **Choice**: Add column via Drizzle migration (e.g. `ALTER TABLE schemas ADD COLUMN system_prompt TEXT`). Default NULL; no backfill required.
   - **Rationale**: Additive; safe for dev/uat/prod. No data transformation.
   - **Alternative**: Default empty string — rejected; null clearly means “not set.”

6. **System prompt size**
   - **Choice**: No server-side max length for `system_prompt` (DB remains `text`). If documenting a size hint for clients (e.g. in OpenAPI), use **5000 characters** as guidance only; no enforcement.
   - **Rationale**: Keeps implementation simple; 5000 chars is a reasonable default hint for UI or client validation if needed later.

## Risks / Trade-offs

- **[Risk] Large system prompts**: Very long text could affect DB size and response payloads.  
  **Mitigation**: Rely on existing limits (e.g. request body size) and optional future limits if needed; no hard DB limit in this change.

- **[Trade-off] OpenAPI maintained by hand**: If the spec is not generated from code, it can drift.  
  **Mitigation**: Add OpenAPI to review checklist when changing routes; consider later code-first generation if the API grows.

## Migration Plan

1. **Backend**: Add `system_prompt` to Drizzle schema; generate and run migration (add column, nullable). Update schema routes and any DTOs/validation to accept and return `system_prompt`.
2. **Frontend**: Add system prompt field to Schemas create/edit form and view; ensure create/update payloads and display use the new field.
3. **OpenAPI**: Add or update the OpenAPI document at `docs/openapi.yaml` so every current endpoint (including schema with `system_prompt`) is described; file-only, not served over HTTP.
4. **Rollback**: Revert code and run a migration that drops `system_prompt` if needed. Existing clients that do not send `system_prompt` are unaffected; clients that do would need to stop sending it after rollback.

## Open Questions

- None; OpenAPI path (`docs/openapi.yaml`, not served over HTTP) and system prompt size (no server max; optional 5000-character hint in spec) are decided above.
