# Schema Chunk Reference

## ADDED Requirements

### Requirement: Each chunk retains its original referencing sentence

The system SHALL store, for each chunk, the exact sentence (or text span) from the original schema content that the chunk was derived from, so that search results can be attributed to the source document.

#### Scenario: Chunk object includes original reference

- **WHEN** a chunk is created and stored in Weaviate
- **THEN** the chunk object SHALL include a property (e.g. `originalReference`) containing the source sentence or span from the schema content
- **AND** that property SHALL be readable by consumers (e.g. returned in search results or object GET)

#### Scenario: Search results expose original reference

- **WHEN** a consumer queries Weaviate for chunks (e.g. vector or keyword search)
- **THEN** each returned chunk SHALL include the original referencing sentence (or span)
- **AND** consumers SHALL be able to use this to cite or display the source in the schema document

### Requirement: Chunk metadata supports traceability to schema

Each chunk object SHALL include metadata that identifies the schema and its version, so that consumers can correlate chunks with the correct schema document.

#### Scenario: Chunk has schema identity and ordering

- **WHEN** chunks are stored
- **THEN** each chunk SHALL have a property identifying the schema (e.g. `schemaId`)
- **AND** each chunk MAY have a property indicating order or index (e.g. `chunkIndex`) for reassembly or ordering if needed
