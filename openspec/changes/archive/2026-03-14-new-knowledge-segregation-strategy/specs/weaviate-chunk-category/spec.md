## ADDED Requirements

### Requirement: Weaviate chunks have optional category and subcategory

Each Weaviate chunk object SHALL include optional `category` and `subcategory` properties (text). Both SHALL be set at chunk creation time and SHALL be available for filtering and for querying related information alongside `content` and `originalReference`. Values SHALL be at most 50 characters; the system MUST truncate or omit values longer than 50 characters when writing to Weaviate.

#### Scenario: Category and subcategory stored on publish

- **WHEN** a schema is published and chunks are written to Weaviate
- **THEN** each chunk object includes `category` and `subcategory` properties (nullable or omitted when not provided)

#### Scenario: Category and subcategory length capped

- **WHEN** a chunk has `category` or `subcategory` longer than 50 characters
- **THEN** the value stored in Weaviate is truncated to 50 characters (or the property is omitted if empty after truncation)

#### Scenario: Filtering by category or subcategory

- **WHEN** a consumer queries Weaviate for chunks
- **THEN** the consumer MAY filter or group by `category` and `subcategory` in addition to existing properties
