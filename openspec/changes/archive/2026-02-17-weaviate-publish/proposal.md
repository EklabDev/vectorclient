# Weaviate Publish: Chunked Facts with Vector Search

## Why

Today, "publish to Weaviate" copies the full schema content from Postgres into a single Weaviate object per schema. That does not use Weaviate as a vector store: there is no semantic search, and downstream consumers still have to load and scan large documents. Weaviate should eliminate the need to constantly refer to a large document by storing small, retrievable chunks of facts that can be queried by meaning.

## What Changes

- **Publish behavior**: Instead of storing one record per schema, publish will:
  - Use OpenAI to break schema content into small, self-contained chunks of facts.
  - Store each chunk as a separate Weaviate object in a collection identified by the schema (e.g. collection = schema id from Postgres).
  - Retain the original referencing sentence (or span) for each chunk so consumers can trace back to source text.
- **Weaviate usage**: One collection per schema (keyed by schema id); multiple chunk objects per collection; vectors generated (e.g. via OpenAI) so semantic search is possible.
- **No change** to the trigger for publish (still on schema create/update/publish when content changes); only the way content is written to Weaviate changes.

## Capabilities

### New Capabilities

- **weaviate-chunked-publish**: Breaking schema content into small factual chunks (via OpenAI), storing each chunk in Weaviate with vector and original-reference text, keyed by schema id collection.
- **schema-chunk-reference**: Storing and returning the original referencing sentence (or text span) for each chunk so results can be attributed to the source document.

### Modified Capabilities

- _(None; no existing OpenSpec specs in this repo yet.)_

## Impact

- **Backend**: `WeaviateService` (and any callers) must support chunked writes instead of a single-object write; new dependency on OpenAI (or similar) for chunking and optionally for embeddings.
- **Weaviate**: Collection-per-schema model remains; schema definition changes to support chunk-level properties (e.g. `content`, `originalReference`, `schemaId`, `chunkIndex`) and a vectorizer (e.g. text2vec-openai) for semantic search.
- **Configuration**: OpenAI API key (or equivalent) required for chunking and for Weaviate vectorizer if using OpenAI.
- **APIs**: Publish/sync API contract can stay the same (schema id, name, content, description); only the storage format and number of objects in Weaviate change.
