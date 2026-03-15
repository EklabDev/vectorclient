## Context

- **Current state**: On schema publish, the backend uses `ChunkingService` (OpenAI) to break schema content into factual chunks. Each chunk has `content`, `originalReference`, and `chunkIndex`. The prompt asks for "one discrete fact per chunk" and "exact sentence or span" for originalReference, but does not explicitly require preserving URLs, emails, or phone numbers, so the model often summarizes and drops them. Chunks are written to Weaviate with properties: content, originalReference, schemaId, schemaName, version, chunkIndex. There are no category or subcategory fields; querying for "related" information relies only on vector similarity and content.
- **Stakeholders**: Backend (Node/TypeScript, ChunkingService, WeaviateService), downstream consumers (AI agents, n8n) that query Weaviate.
- **Constraints**: Publish trigger and API contract unchanged. Full replace on publish remains (delete collection / clear objects, then insert new chunks). Existing Weaviate collections have no category/subcategory; migration or re-publish required for existing data.

## Goals / Non-Goals

**Goals:**

- Preserve URLs, email addresses, phone numbers, and similar concrete detail in chunk content and originalReference (no summarization that drops them).
- Add optional **category** and **subcategory** to each Weaviate chunk so consumers can filter or query for related information.
- Keep chunks factual and self-contained; category/subcategory are metadata to aid retrieval, not a replacement for content.

**Non-Goals:**

- Changing when or how publish is triggered (no API changes).
- Supporting partial updates to Weaviate (still full replace per schema).
- Defining a fixed taxonomy for category/subcategory (values can be free-form or model-generated).
- Implementing the consumer-side query API in this repo (consumers query Weaviate directly).

## Decisions

1. **Detail preservation via prompt**
   - **Choice**: Update the chunking prompt to explicitly require preserving URLs, emails, phone numbers, and other concrete identifiers verbatim in both `content` and `originalReference`. Add examples in the prompt that show these preserved. Keep response format (e.g. JSON with `chunks` array). No regex or post-validation step for detail preservation.
   - **Rationale**: Single LLM call stays simple; prompt is the main lever.
   - **Alternative**: Two-phase (summarize then extract detail) — rejected as more complex and higher latency/cost.

2. **Category and subcategory source**
   - **Choice**: Have the same chunking LLM call return `category` and `subcategory` per chunk (e.g. add to each chunk object in the JSON). No separate classification step.
   - **Rationale**: One API call keeps latency and cost lower; the model already understands chunk content and can assign semantic labels. Free-form text allows flexibility (e.g. "Contact", "Pricing", "Support").
   - **Alternative**: Separate classification pass or rule-based taxonomy — rejected for scope; can be revisited if quality is insufficient.

3. **Weaviate property type for category and subcategory**
   - **Choice**: Add `category` and `subcategory` as **text** (string) properties, each with a **maximum length of 50 characters**. Both optional (nullable) so existing or minimal chunks can omit them. When writing chunks, truncate or reject values over 50 characters so stored values never exceed the limit.
   - **Rationale**: Text allows any label; 50 chars keeps labels short and consistent for filtering and display. No need for enum or fixed schema.
   - **Alternative**: Keyword/tokenized only — Weaviate text type is sufficient for filter and display.

4. **Collection schema and existing data**
   - **Choice**: New publishes create collections with the new properties (content, originalReference, schemaId, schemaName, version, chunkIndex, **category**, **subcategory**). Existing collections do not get auto-migrated; re-publishing a schema will recreate the collection (or replace objects) with the new shape, so category/subcategory appear for that schema after re-publish.
   - **Rationale**: Weaviate does not support adding properties to an existing class in all versions; full replace on publish already implies "re-publish refreshes data," so documenting "re-publish to get category/subcategory" is consistent.
   - **Alternative**: Try to add properties to existing class — depends on Weaviate version; avoid for simplicity.

5. **Chunk interface and response shape**
   - **Choice**: Extend the in-memory `Chunk` type (and chunking response parsing) to include optional `category` and `subcategory`. Weaviate write path passes them through (trimmed to 50 chars if present); omit or null if missing.
   - **Rationale**: Minimal change; backward compatible when category/subcategory are absent; 50-char limit enforced at write time.

## Risks / Trade-offs

- **[Risk] LLM still drops detail despite prompt**: Model may ignore instructions under length or complexity pressure.  
  **Mitigation**: Strong prompt wording plus examples (no regex or post-validation).

- **[Risk] Category/subcategory inconsistency**: Free-form labels may vary across chunks or schemas.  
  **Mitigation**: Accept for v1; document that consumers should treat values as hints. Later: optional taxonomy or second pass to normalize.

- **[Trade-off] Larger prompts / tokens**: More instructions and examples can increase token usage.  
  **Mitigation**: Keep examples short; monitor cost and trim if needed.

## Migration Plan

1. **ChunkingService**: Update prompt to require detail preservation (URLs, emails, phones) and to return category and subcategory per chunk. Extend `Chunk` type and response parsing. Add or adjust tests for detail preservation and category/subcategory presence.
2. **WeaviateService**: Add `category` and `subcategory` to collection schema in both `syncSchemaToWeaviate` and `updateSchemaInWeaviate` (and any code paths that create or update chunk objects). Pass through from chunk object to Weaviate properties (optional/nullable).
3. **Existing schemas**: No automatic backfill. Document that re-publishing a schema will recreate chunks with the new shape (detail preservation and category/subcategory). Consumers of existing collections continue to see old shape until re-publish.
4. **Rollback**: Revert prompt and Weaviate schema to previous behavior; re-publish again to restore old-style chunks if needed.

## Open Questions

- None; detail preservation relies on prompt only (no regex check); category and subcategory are capped at 50 characters.
