# API OpenAPI Document

## ADDED Requirements

### Requirement: Single OpenAPI document describes all endpoints

The project SHALL provide a single OpenAPI 3.x document that describes all current API endpoints, including request and response shapes, authentication (if any), and the schema resource with all fields (including `system_prompt`).

#### Scenario: Document location and delivery

- **WHEN** consumers or tooling need the API contract
- **THEN** the OpenAPI document SHALL be available at **`docs/openapi.yaml`** in the repository
- **AND** the document SHALL NOT be served over HTTP; it is file-only

#### Scenario: Schema resource includes system_prompt

- **WHEN** the OpenAPI document describes the schema (Knowledge Base) resource
- **THEN** the schema object SHALL include a `system_prompt` property (type string, nullable or optional)
- **AND** create/update request bodies for schemas SHALL allow an optional `system_prompt` field

#### Scenario: All current endpoints documented

- **WHEN** the OpenAPI document is read
- **THEN** it SHALL describe every current API endpoint (e.g. auth, schemas, endpoints, tokens, etc., as applicable)
- **AND** each endpoint SHALL have path, method(s), and request/response schema or description sufficient for integration

### Requirement: OpenAPI document is valid and usable

The document SHALL be valid OpenAPI 3.x (YAML or JSON). It MAY include a size hint for `system_prompt` (e.g. maxLength: 5000) as client guidance only; the server SHALL NOT enforce that limit.

#### Scenario: Valid OpenAPI 3.x

- **WHEN** the file at `docs/openapi.yaml` is parsed by an OpenAPI 3.x parser
- **THEN** it SHALL parse without structural errors
- **AND** it SHALL include required top-level fields (e.g. openapi, info, paths)
