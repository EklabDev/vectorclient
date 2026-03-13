# Weaviate Chunked Publish

## ADDED Requirements

### Requirement: Schema content is chunked into small facts before storing in Weaviate

The system SHALL use an external service (e.g. OpenAI) to break schema content into small, self-contained factual chunks suitable for vector search. Chunking SHALL produce multiple chunks per schema document.

#### Scenario: Publish creates multiple chunk objects per schema

- **WHEN** a schema is published or synced to Weaviate (create, update, or sync-weaviate)
- **THEN** the system SHALL call the chunking service with the schema content
- **AND** the system SHALL store each resulting chunk as a separate Weaviate object in the collection for that schema

#### Scenario: Collection is keyed by schema id

- **WHEN** chunks are written to Weaviate
- **THEN** all chunks for a given schema SHALL be stored in a single collection
- **AND** the collection identifier SHALL be derived from the schema id (e.g. collection name = schema id from Postgres, sanitized for Weaviate)

#### Scenario: Chunks are vectorized for semantic search

- **WHEN** chunks are stored in Weaviate
- **THEN** each chunk SHALL have a vector representation (e.g. via Weaviate vectorizer or pre-computed embedding)
- **AND** the collection SHALL support semantic / vector search over chunk content

### Requirement: Publish replaces existing chunk data for the schema

The system SHALL treat each publish/sync as a full refresh of that schema's data in Weaviate: remove existing chunk objects for that schema, then insert the new chunks.

#### Scenario: Re-publish replaces previous chunks

- **WHEN** a schema is updated and published (or sync-weaviate is called again)
- **THEN** the system SHALL delete or replace all Weaviate objects in that schema's collection that belonged to the previous version
- **AND** the system SHALL then insert the new set of chunks for the current content
