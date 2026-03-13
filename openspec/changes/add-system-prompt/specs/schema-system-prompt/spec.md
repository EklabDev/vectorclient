# Schema System Prompt

## ADDED Requirements

### Requirement: Schema entity includes optional system prompt

The Schemas (Knowledge Base) entity SHALL support an optional `system_prompt` field. The field SHALL be text with no server-enforced maximum length; a client/UI hint of 5000 characters MAY be used for guidance only.

#### Scenario: Create schema with system prompt

- **WHEN** a client creates a schema via the API with `system_prompt` in the request body
- **THEN** the system SHALL persist the value and return it in the response
- **AND** the schema SHALL be retrievable with the same `system_prompt` value

#### Scenario: Create schema without system prompt

- **WHEN** a client creates a schema without providing `system_prompt`
- **THEN** the system SHALL store the schema with `system_prompt` as null or omit it from the stored representation
- **AND** get/list responses SHALL return `system_prompt` as null or omit it consistently

#### Scenario: Update schema system prompt

- **WHEN** a client updates a schema (full or partial update) and includes `system_prompt` in the request body
- **THEN** the system SHALL persist the new value
- **AND** subsequent get/list responses SHALL return the updated `system_prompt`

#### Scenario: List and get include system prompt

- **WHEN** a client lists schemas or gets a single schema
- **THEN** each schema object SHALL include `system_prompt` (string or null) when the field is present in the API contract

### Requirement: UI supports CRUD for system prompt

The Schemas & Knowledge UI SHALL provide a text field (or text area) for the system prompt in create, edit, and view flows. The field SHALL be optional and SHALL persist when the user saves.

#### Scenario: Create flow includes system prompt field

- **WHEN** the user opens the create-schema form
- **THEN** the form SHALL include an optional "System prompt" text input (or text area)
- **AND** on submit, the value SHALL be sent to the API and stored

#### Scenario: Edit flow allows changing system prompt

- **WHEN** the user edits an existing schema
- **THEN** the form SHALL show the current `system_prompt` value (or empty if null)
- **AND** the user SHALL be able to change it and save; the updated value SHALL be sent to the API

#### Scenario: View flow displays system prompt

- **WHEN** the user views a schema (read-only)
- **THEN** the system prompt SHALL be displayed if present, or a clear indication that none is set
