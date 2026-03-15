## 1. Chunk type and chunking prompt

- [x] 1.1 Extend `Chunk` interface in chunkingService to include optional `category` and `subcategory` (string)
- [x] 1.2 Update chunking prompt to require preserving URLs, emails, and phone numbers verbatim in `content` and `originalReference`; add short examples
- [x] 1.3 Update chunking prompt to require each chunk object to include `category` and `subcategory` (max 50 chars); add to response JSON schema / example
- [x] 1.4 Parse `category` and `subcategory` from LLM response and attach to each Chunk; handle missing or invalid values

## 2. Weaviate schema and write path

- [x] 2.1 Add `category` and `subcategory` (text, optional) to Weaviate collection schema in sync/create and update paths
- [x] 2.2 When writing chunk objects to Weaviate, pass `category` and `subcategory`; truncate to 50 characters if present, omit if null/empty
- [x] 2.3 Ensure all code paths that insert or update chunk objects in Weaviate include the new properties

## 3. Tests

- [x] 3.1 Add or extend chunking tests to assert URLs, emails, or phone numbers from source appear verbatim in chunk content or originalReference
- [x] 3.2 Add or extend chunking tests to assert returned chunks include category and subcategory when provided by the model
- [x] 3.3 Add or extend Weaviate/chunk tests to assert category and subcategory are written and truncated to 50 chars when applicable
