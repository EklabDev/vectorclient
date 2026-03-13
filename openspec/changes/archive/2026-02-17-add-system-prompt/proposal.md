## Why

The Schemas (Knowledge Base) table currently only stores `content` as the knowledge base. Users need to configure a **system prompt** per schema so that AI agents can use both the knowledge base content and a dedicated system prompt when answering or processing requests. Adding `system_prompt` as a first-class field enables per-schema agent behavior without hardcoding prompts. Creating an OpenAPI document for all endpoints then gives consumers and tooling a single, up-to-date contract after this change.

## What Changes

- Add optional **system_prompt** (text) to the Schemas (Knowledge Base) table; existing rows get null/empty until populated.
- Extend schema API (create, read, update) to accept and return `system_prompt`; list responses include the field.
- Update the Schemas & Knowledge UI to support full CRUD for `system_prompt` (text field: create, view, edit, persist).
- Add an **OpenAPI document** that describes all current API endpoints (including the updated schema endpoints with `system_prompt`).

## Capabilities

### New Capabilities

- **schema-system-prompt**: Schema (Knowledge Base) entity supports an optional `system_prompt` text field; backend API and frontend UI support create, read, update for this field alongside existing schema fields.
- **api-openapi-doc**: A single OpenAPI (e.g. 3.x) document describes all API endpoints, including request/response shapes and the schema resource with `system_prompt`, so consumers can discover and integrate against the full API.

### Modified Capabilities

- (None — no existing specs in `openspec/specs/`.)

## Impact

- **Database**: Schemas table gains nullable `system_prompt` (text); migration required for existing environments.
- **Backend**: Schema routes, DTOs, and validation updated to read/write `system_prompt`; existing schema endpoints remain compatible (additive field).
- **Frontend**: Schemas & Knowledge page updated with a system prompt text field in create/edit/view flows.
- **Documentation**: New or updated OpenAPI spec file (or served document) reflecting all endpoints after the schema change.
