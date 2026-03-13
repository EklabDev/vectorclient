# Design: Weaviate Chunked Publish

## Context

- **Current state**: `WeaviateService.syncSchemaToWeaviate` writes one Weaviate object per schema: a single `content` blob plus `schemaId`, `schemaName`, `version`. The collection uses a vectorizer (e.g. text2vec-openai) but the whole document is one object, so semantic search is over the entire document, not over small facts.
- **Stakeholders**: Backend (Node/TypeScript), Weaviate, downstream consumers (e.g. n8n) that query Weaviate for context.
- **Constraints**: Publish trigger stays the same (schema create/update/publish, sync-weaviate); no change to REST API contract for triggering publish. Weaviate collection-per-schema naming is already in place (e.g. `Schema_<schemaId>`).

## Goals / Non-Goals

**Goals:**

- Chunk schema content into small, factual units using OpenAI (or equivalent).
- Store one Weaviate object per chunk in a collection keyed by schema id; support vector search over chunks.
- Retain original referencing sentence per chunk for attribution.
- Full refresh on publish: replace all chunks for that schema with the new set.

**Non-Goals:**

- Changing when publish is triggered (no new API surface for “publish”).
- Supporting partial updates (e.g. append-only chunks); each publish is full replace.
- Implementing the actual Weaviate query API in this repo (consumers query Weaviate directly).

## Decisions

1. **Chunking via OpenAI**
   - **Choice**: Use OpenAI (e.g. chat/completions or a small model) to break schema content into factual chunks and optionally return the original sentence per chunk.
   - **Rationale**: Reduces custom parsing logic and produces semantically coherent chunks. Alternatives: rule-based splitting (e.g. by paragraph/sentence) or another LLM provider; OpenAI is a common choice and aligns with text2vec-openai in Weaviate.
   - **Alternatives**: Rule-based chunking (simpler, no API key); other LLM providers (e.g. Anthropic, local model) if we want to avoid OpenAI later.

2. **Weaviate vectorizer**
   - **Choice**: Use a vectorizer that matches the chunking/embedding story (e.g. `text2vec-openai` so Weaviate auto-embeds chunk text).
   - **Rationale**: Keeps embedding and storage in one place; no need to call OpenAI separately for embeddings if Weaviate is configured with the same model. Alternative: bring-your-own vectors (compute embeddings in backend, store with `vectorizer: 'none'`); more control but more code and consistency concerns.

3. **Collection shape**
   - **Choice**: One collection per schema (keyed by schema id); each object = one chunk with properties: chunk content, original reference, schemaId, schemaName, version, chunkIndex (optional).
   - **Rationale**: Matches current “one collection per schema” model; keeps queries simple (single collection = one schema’s chunks). Alternative: one global “chunks” collection with schemaId as a property; possible but shifts query patterns and indexing.

4. **Full replace on publish**
   - **Choice**: On each publish/sync, delete (or drop and recreate) all objects for that schema’s collection, then insert the new chunk set.
   - **Rationale**: Avoids incremental/diff logic and keeps Weaviate in sync with Postgres content. Alternative: versioned collections or soft-delete; adds complexity and may not be needed for current use case.

## Risks / Trade-offs

- **[Risk] OpenAI rate limits / cost**: Chunking every publish uses API calls.  
  **Mitigation**: Limit input size if needed; consider caching or idempotent publish (e.g. content hash) to skip when unchanged.

- **[Risk] Chunking quality**: Poor prompts may produce too many tiny chunks or merge unrelated facts.  
  **Mitigation**: Define a clear chunking prompt (e.g. “one fact per chunk”, “retain original sentence”); iterate in design/tasks and optionally make chunk size/strategy configurable later.

- **[Risk] Original reference fidelity**: LLM might paraphrase instead of returning exact span.  
  **Mitigation**: Prompt explicitly for “exact sentence or span from the source”; optionally validate that the returned span exists in the original content and fall back to substring match if needed.

- **[Trade-off] Dependency on OpenAI**: Adds configuration (API key) and an external dependency.  
  **Mitigation**: Document env vars; consider a feature flag or fallback (e.g. single-object legacy behavior) for environments without OpenAI.

## Migration Plan

1. **Backend**: Implement chunking (OpenAI) and new Weaviate write path (multi-object, full replace) behind existing `syncSchemaToWeaviate` (and update path) so API and trigger stay the same.
2. **Config**: Add `OPENAI_API_KEY` (or equivalent); document in env.example and deployment docs.
3. **Weaviate**: Ensure collection schema includes chunk-level properties (`content`, `originalReference`, `schemaId`, `schemaName`, `version`, `chunkIndex` if used) and vectorizer; migration = new publish flow creates/updates collections with this shape.
4. **Rollback**: If issues arise, revert to single-object write (one blob per schema) and re-publish; existing consumers that query by collection and expect one object would need to be updated to query multiple objects per collection.

## Open Questions

- Exact OpenAI prompt and model for chunking (and whether to use the same model as Weaviate’s vectorizer).
- Max content length per schema to send to OpenAI in one request; whether to split very large documents into multiple chunking calls.
- Whether `chunkIndex` is required for ordering or only for debugging/traceability.
