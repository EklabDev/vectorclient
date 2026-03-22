## ADDED Requirements

### Requirement: Schema cards show system prompt and published object count

On the schema list view, each card SHALL continue to show a content preview as today. When **`systemPrompt`** is set, the card SHALL display it (truncated or summarized for layout as needed). When the schema is **published**, the card SHALL display the **number of objects** in the associated Weaviate collection (from the count API or equivalent).

#### Scenario: System prompt visible when present

- **WHEN** a schema has a non-empty `systemPrompt`
- **THEN** the card shows that system prompt (or a truncated preview) in addition to content preview

#### Scenario: Object count when published

- **WHEN** a schema is published and has a Weaviate collection
- **THEN** the card shows the object count returned by the backend for that schema

#### Scenario: No count when unpublished

- **WHEN** a schema is not published
- **THEN** the card does not show a Weaviate object count (or shows zero / “not published” as defined by implementation)
