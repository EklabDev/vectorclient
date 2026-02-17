# Tasks: Weaviate Chunked Publish

## 1. Configuration and dependencies

- [x] 1.1 Add OpenAI client dependency (e.g. `openai` package) to backend
- [x] 1.2 Add `OPENAI_API_KEY` to backend env.example and document in deployment docs
- [x] 1.3 Ensure Weaviate collection config supports chunk-level properties and vectorizer (e.g. text2vec-openai)

## 2. Chunking service

- [x] 2.1 Implement a chunking function that calls OpenAI to break schema content into small factual chunks
- [x] 2.2 Chunking response MUST include for each chunk: fact text and original referencing sentence (or span)
- [x] 2.3 Handle empty or very short content (no chunks or single chunk)
- [x] 2.4 Add unit or integration tests for chunking (e.g. mock OpenAI, assert chunk count and structure)

## 3. Weaviate collection schema for chunks

- [x] 3.1 Define Weaviate collection class with properties: content (chunk text), originalReference, schemaId, schemaName, version, chunkIndex (optional)
- [x] 3.2 Configure vectorizer (e.g. text2vec-openai) on the collection for semantic search
- [x] 3.3 Ensure collection name is derived from schema id (e.g. Schema_<schemaId> sanitized)

## 4. Publish flow: full replace with chunks

- [x] 4.1 On syncSchemaToWeaviate: call chunking service with schema content; obtain list of chunks with originalReference
- [x] 4.2 Delete or clear existing Weaviate objects for that schema's collection before inserting new chunks
- [x] 4.3 Insert each chunk as a separate Weaviate object with content, originalReference, schemaId, schemaName, version, chunkIndex
- [x] 4.4 Update updateSchemaInWeaviate to use the same chunked flow (full replace)
- [x] 4.5 Preserve existing API contract: syncSchemaToWeaviate and updateSchemaInWeaviate still return collection name; no change to route handlers that call them

## 5. Error handling and rollback

- [x] 5.1 Handle OpenAI failures (e.g. rate limit, timeout): return clear error and do not partially write to Weaviate
- [x] 5.2 If Weaviate write fails after delete, document rollback behavior (e.g. re-publish restores data)

## 6. Verification

- [x] 6.1 Manually test publish: create/update a schema with non-trivial content, verify multiple chunk objects in Weaviate with vectors and originalReference
- [x] 6.2 Verify semantic search over chunks returns relevant chunks and originalReference is present in results
